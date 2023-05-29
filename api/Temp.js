const express = require('express');
const router = express.Router();
const geoIPLite = require('geoip-lite')


const HTTPLibrary = require('../libraries/HTTP');
const HTTPHandler = new HTTPLibrary();

const DEFAULTS = require('../defaults');
const CONSTANTS = require('../constants');

//require('dotenv').config();
const fs = require('fs')
const S3 = require('aws-sdk/clients/s3')

const bucketName = process.env.AWS_BUCKET_NAME
const region = process.env.AWS_BUCKET_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY
const secretAccessKey = process.env.AWS_SECRET_KEY

const s3 = new S3 ({
    region,
    accessKeyId,
    secretAccessKey
})

const util = require('util')
const unlinkFile = util.promisify(fs.unlink)

const { uploadFile, getFileStream } = require('../s3')

const rateLimit = require('express-rate-limit')

// mongodb user model
const User = require('./../models/User');
const Poll = require('./../models/Poll');
const ImagePost = require('./../models/ImagePost');
const Category = require('./../models/Category');
const Thread = require('./../models/Thread')
const Message = require('./../models/Message')
const PostReports = require('../models/PostReports')
const AccountReports = require('../models/AccountReports');
const Upvote = require('../models/Upvote');
const Downvote = require('../models/Downvote')

const { tokenValidation, refreshTokenDecryption } = require("../middleware/TokenHandler");

router.all("*", [tokenValidation]); // the * just makes it that it affects them all it could be /whatever and it would affect that only

//Notification stuff


const RefreshToken = require('../models/RefreshToken');
const PopularPosts = require('../models/PopularPosts');

const rateLimiters = {
    '/updateLoginActivitySettingsOnSignup': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 5, //Should only be doing this once for the whole lifetime of the account but will have this set to 5 just in case
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have updated your login activity settings on signup too many times today. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/followingFeedFilterSettings': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested your following feed settings on signup too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    })
}

router.post('/updateLoginActivitySettingsOnSignup', rateLimiters['/updateLoginActivitySettingsOnSignup'], HTTPHandler.getDeviceTypeMiddleware(), (req, res) => {
    const userId = req.tokenData;
    const {newSettings, refreshTokenId} = req.body;

    if (typeof newSettings !== 'object') {
        return HTTPHandler.badInput(res, `newSettings must be an object. Provided type: ${typeof newSettings}`)
    }

    if (Array.isArray(newSettings)) {
        return HTTPHandler.badInput(res, 'newSettings must be an object. An array was provided.')
    }

    if (newSettings === null) {
        return HTTPHandler.badInput(res, 'newSettings must be an object. null was provided.')
    }

    if (typeof refreshTokenId !== 'string') {
        return HTTPHandler.badInput(res, `refreshTokenId must be a string. Provided type: ${typeof refreshTokenId}`)
    }

    if (refreshTokenId.length == 0) {
        return HTTPHandler.badInput(res, 'refreshTokenId cannot be an empty string.')
    }

    const allowedKeyValues = {
        getIP: [false, true],
        getDeviceType: [false, true],
        getLocation: [false, true]
    }

    const allowedKeys = Object.keys(allowedKeyValues)

    for (const key of Object.keys(newSettings)) {
        if (!allowedKeys.includes(key) || !allowedKeyValues[key].includes(newSettings[key])) {
            delete newSettings[key];
        }
    }

    User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.badInput(res, 'User could not be found with provided userId')
        }

        const loginActivitySettingsToSet = {...userFound.settings.loginActivitySettings, ...newSettings}
        const settingsToSet = {...userFound.settings, loginActivitySettings: loginActivitySettingsToSet}

        User.findOneAndUpdate({_id: {$eq: userId}}, {settings: settingsToSet}).then(() => {
            const changesToMake = {}

            if (loginActivitySettingsToSet.getIP) {
                changesToMake.IP = HTTPHandler.getIP(req)
            }

            if (loginActivitySettingsToSet.getLocation) {
                const location = geoIPLite.lookup(req.ip)
                changesToMake.location = location.city + ', ' + location.country
            }

            if (loginActivitySettingsToSet.getDeviceType) {
                changesToMake.deviceType = req.device.name
            }

            RefreshToken.findOneAndUpdate({_id: {$eq: refreshTokenId}, userId: {$eq: userId}}, changesToMake).then(() => {
                HTTPHandler.OK(res, 'Successfully updated settings')
            }).catch(error => {
                console.error('An error occurred while updating refresh token with id:', refreshTokenId, 'that belongs to user with id:', userId, '. The update was going to make these updates:', changesToMake, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while updating refresh token. Please try again later.')
            })
        }).catch(error => {
            console.error('An error occurred while updating user settings. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while updating login activity settings. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.get('/followingFeedFilterSettings', rateLimiters['/followingFeedFilterSettings'], (req, res) => {
    const userId = req.tokenData;

    User.findOne({_id: {$eq: userId}}, 'settings.followingFeedFilterSettings').then(projectedUserObject => {
        if (!projectedUserObject) {
            return HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }

        const toSend = {...projectedUserObject?.settings?.followingFeedFilterSettings || {}, ...DEFAULTS.userFollowingFeedFilterSettings}

        HTTPHandler.OK(res, 'Found following feed filter settings', toSend)
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userId, 'with projection "settings.followingFeedFilterSettings". The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

module.exports = router;