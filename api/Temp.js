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
    '/turnOffEmailMultiFactorAuthentication': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 3,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have turned off email multi-factor authentication too many times today. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/deleteaccount': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 1,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have tried to delete your account too many times today. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/checkIfCategoryExists/:categoryTitle': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have checked if a certain category exists too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/uploadNotificationsSettings': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have updated your notifications settings too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getUserNotificationSettings': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested notifications settings too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/reportUser': rateLimit({
        windowMs: 1000 * 60 * 60, //1 hour
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "The network you are connected to has sent too many report user requests in the last hour. Please wait 60 minutes before trying to report the user again."},
        skipFailedRequests: true
        //keyGenerator function is not provided for this rate limiter. By default if the keyGenerator function is not provided, express-rate-limit will use the IP address as the key
        //This means this rate limiter will be limiting requests per IP instead of per account
    }),
    '/getUserActivity': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested user activity too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getCategoriesUserIsAPartOf': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 3,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested the categories you are part of too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/reportPost': rateLimit({
        windowMs: 1000 * 60 * 60, //1 hour
        max: 100,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "The network you are connected to has sent too many report post requests in the last hour. Please wait 60 minutes before trying to report the post again."},
        skipFailedRequests: true
        //keyGenerator function is not provided for this rate limiter. By default if the keyGenerator function is not provided, express-rate-limit will use the IP address as the key
        //This means this rate limiter will be limiting requests per IP instead of per account
    }),
    '/userAlgorithmSettings': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 4,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested your algorithm settings too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/uploadAlgorithmSettings': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have changed your algorithm settings too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/privacySettings': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 4,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested your privacy settings too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/savePrivacySettings': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have updated your privacy settings too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getProfileStats': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested profile stats too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/loginactivity': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested profile stats too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.ip + req.tokenData //The account's login activity will be rate limited per account per IP address
    }),
    '/logoutdevice': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have logged devices out of your account too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.ip + req.tokenData //The account's login activity will be rate limited per account per IP address
    }),
    '/logoutallotherdevices': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 3,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have logged all other devices out of your account too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.ip + req.tokenData //The account's login activity will be rate limited per account per IP address
    }),
    '/loginActivitySettings': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested your login activity settings too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/uploadLoginActivitySettings': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have changed your login activity settings too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
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

router.post('/turnOffEmailMultiFactorAuthentication', rateLimiters['/turnOffEmailMultiFactorAuthentication'], (req, res) => {
    const userID = req.tokenData;

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (userFound) {
            User.findOneAndUpdate({_id: {$eq: userID}}, {$pull: {authenticationFactorsEnabled: 'Email'}, $unset: {MFAEmail: "this removes the MFAEmail field"}}).then(function() {
                HTTPHandler.OK(res, 'Email multi-factor authentication has been turned off successfully.')

                var emailData = {
                    from: process.env.SMTP_EMAIL,
                    to: userFound[0].email,
                    subject: "Email Multi-Factor Authentication Turned Off",
                    text: `Email Multi-Factor authentication has now been turned off for your account. If you did not request for this to happen, someone else may be logged into your account. If so, change your password immediately.`,
                    html: `<p>Email Multi-Factor authentication has now been turned off for your account. If you did not request for this to happen, someone else may be logged into your account. If so, change your password immediately.</p>`
                };

                mailTransporter.sendMail(emailData, function(error, response) {
                    if (error) {
                        console.error('An error occured while sending an email to user with ID:', userID, '. The error was:', error, ' The emailData was:', emailData)
                    }
                })
            }).catch(error => {
                console.error('An error occurred while pulling:', 'Email', 'from:', 'authenticationFactorsEnabled', 'and unsetting the field:', 'MFAEmail', 'for user with id:', userID, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while turning off email multi-factor authentication. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'User not found.')
        }
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/deleteaccount', rateLimiters['/deleteaccount'], (req, res) => {
    const userID = req.tokenData;
    console.log('Trying to delete user with ID: ' + userID)

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'User with provided userId could not be found')
        }

        PopularPosts.findOne({}).lean().then(popularPostDocument => {
            const popularPosts = popularPostDocument.popularPosts
            const newPopularPosts = popularPosts.filter(post => post.creatorId.toString() !== userID)

            PopularPosts.findOneAndUpdate({}, {popularPosts: newPopularPosts}).then(() => {
                ImagePost.find({creatorId: {$eq: userID}}).lean().then(imagePosts => {
                    const imageKeys = imagePosts.map(post => post.imageKey)
                    Thread.find({creatorId: {$eq: userID}}).lean().then(threadPosts => {
                        const threadImageKeys = threadPosts.filter(post => post.threadType === "Images").map(post => post.threadImageKey)
                        Promise.all([
                            userFound?.profileImageKey ? fs.promises.unlink(path.resolve(process.env.UPLOADED_PATH, userFound.profileImageKey)) : Promise.resolve('Profile Image Deleted'),
                            ...imageKeys.map(key => fs.promises.unlink(path.resolve(process.env.UPLOADED_PATH, key))),
                            ImagePost.deleteMany({creatorId: {$eq: userID}}),
                            Poll.deleteMany({creatorId: {$eq: userID}}),
                            ...threadImageKeys.map(key => fs.promises.unlink(path.resolve(process.env.UPLOADED_PATH, key))),
                            Thread.deleteMany({creatorId: {$eq: userID}}),
                            Message.deleteMany({senderId: {$eq: userID}}),
                            User.updateMany({followers: userFound.secondId}, {$pull: {followers: userFound.secondId}}),
                            User.updateMany({following: userFound.secondId}, {$pull: {following: userFound.secondId}}),
                            User.updateMany({blockedAccounts: userFound.secondId}, {$pull: {blockedAccounts: userFound.secondId}}),
                            Downvote.deleteMany({userPublicId: userFound.secondId}),
                            Upvote.deleteMany({userPublicId: userFound.secondId}),
                            User.updateMany({accountFollowRequests: userFound.secondId}, {$pull: {accountFollowRequests: userFound.secondId}}),
                            AccountReports.deleteMany({reporterId: {$eq: userID}}),
                            PostReports.deleteMany({reporterId: {$eq: userID}}),
                            RefreshToken.deleteMany({userId: {$eq: userID}}),
                            Category.updateMany({}, {$pull: {members: userID}})
                        ]).then(() => {
                            User.deleteOne({_id: {$eq: userID}}).then(() => {
                                HTTPHandler.OK(res, 'Successfully deleted account and all associated data.')
                            }).catch(error => {
                                console.error('An error occured while deleting user with id:', userID, '. The error was:', error)
                                HTTPHandler.serverError(res, 'An error occurred while deleting account. Please try again later.')
                            })
                        }).catch(error => {
                            console.error('An error occured while deleting account data for user with id:', userID, '. The error was:', error)
                            HTTPHandler.serverError(res, 'An error occurred while deleting data. Please try again later.')
                        })
                    }).catch(error => {
                        console.error('An error occurred while finding all threads from user with id:', userID, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding user thread posts.')
                    })
                }).catch(error => {
                    console.error('An error occured while finding all user image posts by user with id:', userID, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding user image posts.')
                })
            }).catch(error => {
                console.error('An error occurred while updating popularPosts array for popularPosts collection. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while updating popular posts. Please try again.')
            })
        }).catch(error => {
            console.error('An error occurred while finding popular posts. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding popular posts. Please try again.')
        })
    }).catch(error => {
        console.error('An error occured while finding user with id:', userID + '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again.')
    })
})

router.get('/checkIfCategoryExists/:categoryTitle', rateLimiters['/checkIfCategoryExists/:categoryTitle'], (req, res) => {
    let categoryTitle = req.params.categoryTitle;

    Category.countDocuments({categoryTitle: {'$regex': `^${categoryTitle}$`, $options: 'i'}}).then(categoryCount => {
        if (categoryCount > 0) {
            HTTPHandler.OK(res, true)
        } else {
            HTTPHandler.OK(res, false)
        }
    }).catch(error => {
        console.error('An error occured while checking if a category existed with title:', categoryTitle, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred. Please try again later.')
    })
})

router.post('/uploadNotificationsSettings', rateLimiters['/uploadNotificationsSettings'], (req, res) => {
    const userID = req.tokenData;
    let {notificationSettings} = req.body;

    if (typeof notificationSettings !== 'object' || notificationSettings === null || Array.isArray(notificationSettings)) {
        return HTTPHandler.badInput(res, `notificationSettings must be an object. Is null: ${notificationSettings === null} Is array: ${Array.isArray(notificationSettings)} Type provided: ${typeof notificationSettings}`)
    }

    const allowedKeys = [
        'GainsFollower'
    ]

    User.find({_id: {$eq: userID}}).then(userFound => {
        if (userFound.length) {
            for (let [key, value] of Object.entries(notificationSettings)) {
                if (!allowedKeys.includes(key) || typeof value !== 'boolean') {
                    delete notificationSettings[key]
                }
            }

            const newUserSettings = {
                ...userFound.settings,
                notificationSettings: {
                    ...userFound.settings.notificationSettings,
                    ...notificationSettings
                }
            }

            User.findOneAndUpdate({_id: {$eq: userID}}, {settings: newUserSettings}).then(function() {
                HTTPHandler.OK(res, 'Notification settings updated successfully.')
            }).catch(error => {
                console.error('An error occured while changing notification settings for user with ID:', userID, '. The error was:', error);
                HTTPHandler.serverError(res, 'An error occurred while updating notification settings.')
            })
        } else {
            HTTPHandler.notFound(res, 'User not found.')
        }
    }).catch(error => {
        console.error('An error occurred while finding user with ID:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.get('/getUserNotificationSettings', rateLimiters['/getUserNotificationSettings'], (req, res) => {
    const userID = req.tokenData;

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'User with provided userId cannot be found')
        }

        const defaults = {
            GainsFollower: true,
            FollowRequests: true,
            SendGainsFollower: true,
            SendFollowRequests: true
        }

        const toSend = {...defaults, ...userFound?.settings?.notificationSettings || {}}

        HTTPHandler.OK(res, 'Notification settings retrieved successfully.', toSend)
    }).catch(error => {
        console.error('An error occurred while finding user with ID:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

const validReportOptions = {Content: ["Spam", "Nudity/Sexual", "Don't Like", "Hate", "SelfHarm", "Illegal/Regulated goods", "Violence/Dangerous", "Bullying/Harassment", "Intellectual property violation", "Scam/Fraud", "False Info"], Age: ["Underage"], Impersonation: ["Of Reporter", "Of Someone Reporter Knows", "Celebrity/Public", "Business/Organisation"]}

router.post('/reportUser', rateLimiters['/reportUser'], (req, res) => {
    const reporterId = req.tokenData;
    let {reportType, reporteePubId} = req.body; // maybe add a body which is just text the reporter can add to emphasize their point.

    if (typeof reporteePubId !== 'string') {
        return HTTPHandler.badInput(res, `reporteePubId must be a string. Provided type: ${typeof reporteePubId}`)
    }

    if (reporteePubId.length == 0) {
        return HTTPHandler.badInput(res, 'reporteePubId cannot be a blank string.')
    }

    if (typeof reportType !== 'object' || Array.isArray(reportType) || reportType === null) {
        return HTTPHandler.badInput(res, `reportType must be an object. Is array: ${Array.isArray(reportType)} Is null: ${reportType === null} Provided type: ${typeof reportType}`)
    }

    if (!Object.hasOwn(reportType, 'topic')) {
        return HTTPHandler.badInput(res, `reportType object must have a topic key`)
    }

    if (!Object.hasOwn(reportType, 'subTopic')) {
        return HTTPHandler.badInput(res, `reportType object must have a subTopic key`)
    }

    if (validReportOptions[reportType?.topic]?.includes(reportType?.subTopic)) {
        return HTTPHandler.badInput(res, 'Invalid report options provided.')
    }

    User.findOne({_id: {$eq: reporterId}}).lean().then(reporterFound => {
        if (!reporterFound) {
            return HTTPHandler.notFound(res, 'User could not be found with provided userId')
        }

        User.findOne({secondId: {$eq: reporteePubId}}).lean().then(reporteeFound => {
            if (!reporteeFound) {
                return HTTPHandler.notFound(res, 'Could not find user to report.')
            }

            if (reporterFound._id.toString() === reporteeFound._id.toString()) {
                return HTTPHandler.forbidden(res, 'You cannot report yourself')
            }

            console.log(`Valid report passed by: ${reporterFound[0].name} about ${reporteeFound[0].name} with the reasoning being: ${reportType.topic}-${reportType.subTopic}`)

            const report = {
                reportedAccountPubId: reporteePubId,
                reporterId: reporterId,
                topic: reportType.topic,
                subTopic: reportType.subTopic
            }

            const newUserReport = new AccountReports(report)
            
            newUserReport.save().then(() => {
                HTTPHandler.OK(res, 'Successfully sent report')
            }).catch(error => {
                console.error('An error occurred while saving user report. The report was:', report, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while saving account report.')
            })
        }).catch(error => {
            console.error('An error occurred while finding one user with secondId:', reporteePubId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding user to report. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', reporterId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/getUserActivity', rateLimiters['/getUserActivity'], async (req, res) => {
    const userID = req.tokenData;
    let {skip = 0, voteType, postType} = req.body;
    const limit = 20;
    let userFound;

    skip = parseInt(skip)
    if (isNaN(skip)) {
        return HTTPHandler.badInput(res, 'Skip value is not a number.')
    }

    if (voteType !== 'down' && voteType !== 'up') {
        return HTTPHandler.badInput(res, 'voteType must be either "down" or "up"')
    }

    const supportedPostFormats = ['image', 'video', 'poll', 'thread']

    if (!supportedPostFormats.includes(postType)) {
        HTTPHandler.badInput(res, 'Post type is not a valid post type')
    }

    try {
        userFound = await User.findOne({_id: {$eq: userID}}).lean()
    } catch (error) {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    }

    if (postType === 'image') {

        if (voteType === 'down') {
            Downvote.find({userPublicId: userFound.secondId, postFormat: "Image"}).sort({interactionDate: -1}).skip(skip).limit(limit).lean().then(downvotes => {
                const postIds = downvotes.map(vote => vote.postId)
                ImagePost.find({_id: {$in: postIds}}).lean().then(posts => {
                    HTTPHandler.OK(res, `Successfully found image posts ${skip} - ${skip + posts.length}`, posts)
                }).catch(error => {
                    console.error('An error occured while finding image posts with an id found within this array:', postIds, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding image posts that have been downvoted. Please try again later.')
                })
            }).catch(error => {
                console.error('An error occured while finding downvotes on image posts from user with public id:', userFound.secondId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding downvotes you made on image posts. Please try again later.')
            })
        } else {
            Upvote.find({userPublicId: userFound.secondId, postFormat: "Image"}).sort({interactionDate: -1}).skip(skip).limit(limit).lean().then(upvotes => {
                const postIds = upvotes.map(vote => vote.postId)
                ImagePost.find({_id: {$in: postIds}}).lean().then(posts => {
                    HTTPHandler.OK(res, `Successfully found image posts ${skip} - ${skip + posts.length}`, posts)
                }).catch(error => {
                    console.error('An error occured while finding image posts with an id found within this array:', postIds, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding image posts that have been upvoted. Please try again later.')
                })
            }).catch(error => {
                console.error('An error occured while finding upvotes on image posts from user with public id:', userFound.secondId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding upvotes you made on image posts. Please try again later.')
            })
        }

    } else if (postType === 'video') {
        HTTPHandler.notImplemented(res, 'Video post type is not yet implemented.')
    } else if (postType === 'poll') {

        if (voteType === 'down') {
            Downvote.find({userPublicId: userFound.secondId, postFormat: "Poll"}).sort({interactionDate: -1}).skip(skip).limit(limit).lean().then(downvotes => {
                const postIds = downvotes.map(vote => vote.postId)
                Poll.find({_id: {$in: postIds}}).lean().then(posts => {
                    HTTPHandler.OK(res, `Successfully found poll posts ${skip} - ${skip + posts.length}`, posts)
                }).catch(error => {
                    console.error('An error occured while finding poll posts with an id found within this array:', postIds, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding poll posts that have been downvoted. Please try again later.')
                })
            }).catch(error => {
                console.error('An error occured while finding downvotes on poll posts from user with public id:', userFound.secondId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding downvotes you have made on poll posts. Please try again later.')
            })
        } else {
            Upvote.find({userPublicId: userFound.secondId, postFormat: "Poll"}).sort({interactionDate: -1}).skip(skip).limit(limit).lean().then(upvotes => {
                const postIds = upvotes.map(vote => vote.postId)
                Poll.find({_id: {$in: postIds}}).lean().then(posts => {
                    HTTPHandler.OK(res, `Successfully found poll posts ${skip} - ${skip + posts.length}`, posts)
                }).catch(error => {
                    console.error('An error occured while finding poll posts with an id found within this array:', postIds, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding poll posts that have been upvoted. Please try again later.')
                })
            }).catch(error => {
                console.error('An error occured while finding upvotes on poll posts from user with public id:', userFound.secondId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding upvotes you made on poll posts. Please try again later.')
            })
        }

    } else if (postType === 'thread') {

        if (voteType === 'down') {
            Downvote.find({userPublicId: userFound.secondId, postFormat: "Thread"}).sort({interactionDate: -1}).skip(skip).limit(limit).lean().then(downvotes => {
                const postIds = downvotes.map(vote => vote.postId)
                Thread.find({_id: {$in: postIds}}).lean().then(posts => {
                    HTTPHandler.OK(res, `Successfully found thread posts ${skip} - ${skip + posts.length}`, posts)
                }).catch(error => {
                    console.error('An error occured while finding thread posts with an id found within this array:', postIds, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding thread posts that have been downvoted. Please try again later.')
                })
            }).catch(error => {
                console.error('An error occured while finding downvotes on thread posts from user with public id:', userFound.secondId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding downvotes you made on thread posts. Please try again later.')
            })
        } else {
            Upvote.find({userPublicId: userFound.secondId, postFormat: "Thread"}).sort({interactionDate: -1}).skip(skip).limit(limit).lean().then(upvotes => {
                const postIds = upvotes.map(vote => vote.postId)
                Thread.find({_id: {$in: postIds}}).lean().then(posts => {
                    HTTPHandler.OK(res, `Successfully found thread posts ${skip} - ${skip + posts.length}`, posts)
                }).catch(error => {
                    console.error('An error occured while finding thread posts with an id found within this array:', postIds, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding thread posts that have been upvoted. Please try again later.')
                })
            }).catch(error => {
                console.error('An error occured while finding upvotes on thread posts from user with public id:', userFound.secondId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding upvotes you made on thread posts. Please try again later.')
            })
        }

    }
})

router.post('/getCategoriesUserIsAPartOf', rateLimiters['/getCategoriesUserIsAPartOf'], (req, res) => {
    let {skip = 0} = req.body;
    const userID = req.tokenData;
    const limit = 20;

    skip = parseInt(skip)
    if (isNaN(skip)) {
        return HTTPHandler.badInput(res, 'skip must be an number (integer).')
    }

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with provided userId.')
        }

        const query = { members: { $in: [String(userID)] } }
        Category.find(query).sort({dateCreated: -1}).skip(skip).limit(limit).lean().then(categoriesFound => {
            HTTPHandler.OK(res, `Successfully found categories ${skip} - ${sjip + categoriesFound.length}`, categoriesFound)
        }).catch(error => {
            console.error('An error occured while finding what categories user with id:', userID, 'is part of. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding what categories you are a part of. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/reportPost', rateLimiters['/reportPost'], async (req, res) => {
    const reporterId = req.tokenData;
    let {postId, postFormat, reason} = req?.body || {};

    if (typeof reason !== 'string') {
        return HTTPHandler.badInput(res, `reason must be a string. Provided type: ${typeof reason}`)
    }

    reason = reason.trim()

    if (reason.length === 0) {
        return HTTPHandler.badInput(res, 'You cannot leave reason blank.')
    }

    try {
        if (await User.findOne({_id: {$eq: reporterId}}) == null) {
            return HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }
    } catch (error) {
        console.error('An error occured while finding a user with id: ', reporterId, '. The error was:', error)
        return HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    }

    if (postFormat == 'Image') {
        ImagePost.findOne({_id: {$eq: postId}}).then(async result => {
            if (result) {
                let reportFound;

                try {
                    reportFound = await PostReports.findOne({postId: {$eq: postId}, format: {$eq: postFormat}, reporterId: {$eq: reporterId}}).lean()
                } catch (error) {
                    return HTTPHandler.serverError(res, 'An error occurred while checking if a post report already exists from your account for this post. Please try again later.')
                }

                if (reportFound) {
                    return HTTPHandler.forbidden(res, 'You cannot submit more than one report for the same post.')
                }

                const newReport = new PostReports({
                    postId,
                    format: postFormat,
                    reason,
                    reporterId
                })

                newReport.save().then(() => {
                    HTTPHandler.OK(res, 'Post has successfully been reported')
                }).catch(error => {
                    console.error(`An error occurred while reporting %s post with id: %s. The error was: %s`, postFormat, postId, error)
                    HTTPHandler.serverError(res, 'An error occurred while submitting report. Please try again later.')
                })
            } else {
                HTTPHandler.notFound(res, 'Post could not be found')
            }
        }).catch(error => {
            console.error('An error occured while finding image post with ID:', postId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while getting the image post. Please try again later.')
        })
    } else if (postFormat == 'Poll') {
        Poll.findOne({_id: {$eq: postId}}).then(async result => {
            if (result) {
                let reportFound;

                try {
                    reportFound = await PostReports.findOne({postId: {$eq: postId}, format: {$eq: postFormat}, reporterId: {$eq: reporterId}}).lean()
                } catch (error) {
                    return HTTPHandler.serverError(res, 'An error occurred while checking if a post report already exists from your account for this post. Please try again later.')
                }

                if (reportFound) {
                    return HTTPHandler.forbidden(res, 'You cannot submit more than one report for the same post.')
                }

                const newReport = new PostReports({
                    postId,
                    format: postFormat,
                    reason,
                    reporterId
                })

                newReport.save().then(() => {
                    HTTPHandler.OK(res, 'Post has successfully been reported')
                }).catch(error => {
                    console.error(`An error occured while reporting %s post with id: %s. The error was: %s`, postFormat, postId, error)
                    HTTPHandler.serverError(res, 'An error occurred while submitting report. Please try again later.')
                })
            } else {
                HTTPHandler.notFound(res, 'Post could not be found')
            }
        }).catch(error => {
            console.error('An error occured while finding poll post with ID:', postId, '. The erorr was:', error)
            HTTPHandler.serverError(res, 'An error occurred while getting the poll post. Please try again later.')
        })
    } else if (postFormat == 'Thread') {
        Thread.findOne({_id: {$eq: postId}}).then(async result => {
            if (result) {
                let reportFound;

                try {
                    reportFound = await PostReports.findOne({postId: {$eq: postId}, format: {$eq: postFormat}, reporterId: {$eq: reporterId}}).lean()
                } catch (error) {
                    return HTTPHandler.serverError(res, 'An error occurred while checking if a post report already exists from your account for this post.')
                }

                if (reportFound) {
                    return HTTPHandler.forbidden(res, 'You cannot submit more than one report for the same post.')
                }

                const newReport = new PostReports({
                    postId,
                    format: postFormat,
                    reason,
                    reporterId
                })

                newReport.save().then(() => {
                    HTTPHandler.OK(res, 'Post has successfully been reported')
                }).catch(error => {
                    console.error('An error occured while reporting %s post with id: %s. The error was: %s', postFormat, postId, error)
                    HTTPHandler.serverError(res, 'An error occurred while submitting report. Please try again later.')
                })
            } else {
                HTTPHandler.notFound(res, 'Post could not be found')
            }
        }).catch(error => {
            console.error('An error occured while finding thread post with ID:', postId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding thread post. Please try again later.')
        })
    } else {
        HTTPHandler.badInput(res, `${postFormat} is not a valid post format`)
    }
})

router.get('/userAlgorithmSettings', rateLimiters['/userAlgorithmSettings'], (req, res) => {
    const userID = req.tokenData;

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }

        const defaults = {
            enabled: false,
            useUserUpvoteData: false,
            useUserDownvoteData: false,
            useUserFollowingData: false
        }

        const toSend = {...defaults, ...userFound?.settings?.algorithmSettings || {}}

        HTTPHandler.OK(res, 'Algorithm settings retrieved successully.', toSend)
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/uploadAlgorithmSettings', rateLimiters['/uploadAlgorithmSettings'], (req, res) => {
    const {algorithmSettings} = req.body;
    const userID = req.tokenData;

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (userFound) {
            let newUserSettings = userFound.settings;
            let newAlgorithmSettings = newUserSettings.algorithmSettings;
            if (typeof algorithmSettings.algorithmEnabled == 'boolean') {
                newAlgorithmSettings.algorithmEnabled = algorithmSettings.algorithmEnabled;
            }
            if (typeof algorithmSettings.useUserUpvoteData == 'boolean') {
                newAlgorithmSettings.useUserUpvoteData = algorithmSettings.useUserUpvoteData;
            }
            if (typeof algorithmSettings.useUserDownvoteData == 'boolean') {
                newAlgorithmSettings.useUserDownvoteData = algorithmSettings.useUserDownvoteData;
            }
            if (typeof algorithmSettings.useUserFollowingData == 'boolean') {
                newAlgorithmSettings.useUserFollowingData = algorithmSettings.useUserFollowingData;
            }
            newUserSettings.algorithmSettings = newAlgorithmSettings;

            User.findOneAndUpdate({_id: {$eq: userID}}, {settings: newUserSettings}).then(function() {
                HTTPHandler.OK(res, 'Algorithm settings updated successfully.')
            }).catch(error => {
                console.error('An error occured while changing settings for user with ID:', userID, 'The new settings are:', newUserSettings, '. Only algorithm settings got changed. These are the new algorithm settings:', newAlgorithmSettings, '. The error was:', error);
                HTTPHandler.serverError(res, 'An error occurred while updating algorithm settings. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }
    }).catch(error => {
        console.error('An error occured while finding user with ID: ' + userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while trying to find the user. Please try again later.')
    })
})

router.get('/privacySettings', rateLimiters['/privacySettings'], (req, res) => {
    const userID = req.tokenData;

    const defaults = {
        viewFollowers: 'followers', //Options are: 'no-one', 'followers', 'everyone'
        viewFollowing: 'followers', //Options are 'no-one', 'followers', 'everyone',
        showBadges: 'everyone' //Options are 'no-one', 'followers', 'everyone',
    }

    User.findOne({_id: {$eq: userID}}).lean().then(user => {
        if (user) {
            const privacySettings = {...defaults, ...user?.settings?.privacySettings};
            HTTPHandler.OK(res, 'Sent privacy settings', privacySettings)
        } else {
            HTTPHandler.notFound(res, 'User not found')
        }
    }).catch(error => {
        console.error('An error occured while getting user with ID:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/savePrivacySettings', rateLimiters['/savePrivacySettings'], (req, res) => {
    const userID = req.tokenData;
    const settings = req.body.settings;

    if (typeof settings !== 'object') {
        return HTTPHandler.badInput(res, `settings must be an object. Provided type: ${typeof settings}`)
    }

    if (Array.isArray(settings)) {
        return HTTPHandler.badInput(res, 'Settings must be an object. Provided was an array.')
    }

    if (settings === null) {
        return HTTPHandler.badInput(res, 'Settings must be an object. Provided was null.')
    }

    const allowedValues = {
        viewFollowers: ['no-one', 'followers', 'everyone'],
        viewFollowing: ['no-one', 'followers', 'everyone'],
        showBadges: ['no-one', 'followers', 'everyone']
    }

    const allowedKeys = Object.keys(allowedValues)

    console.log('New Privacy Settings:', settings)

    for (let [key, value] of Object.entries(settings)) {
        if (!allowedKeys.includes(key) || !allowedValues[key].includes(value)) {
            console.log('Deleting key:', key, '  value:', value, '  from /tempRoute/savePrivacySettings')
            delete settings[key]
        }
    }

    User.findOne({_id: {$eq: userID}}).lean().then(user => {
        if (user) {
            const newPrivacySettings = {
                ...user?.settings?.privacySettings,
                ...settings
            }

            const newSettings = {
                ...user.settings,
                privacySettings: newPrivacySettings
            }

            User.findOneAndUpdate({_id: {$eq: userID}}, {settings: newSettings}).then(() => {
                HTTPHandler.OK(res, 'Successfully updated privacy settings')
            }).catch(error => {
                console.error('An error occured while updating privacy settings for user with ID:', userID, 'The new privacy settings are:', newPrivacySettings, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while updating privacy settings. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'Could not find user with userId provided.')
        }
    }).catch(error => {
        console.error('An error occured while finding user with ID:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding the user. Please try again later.')
    })
})

router.post('/getProfileStats', rateLimiters['/getProfileStats'], (req, res) => {
    const userRequestingID = req.tokenData;
    const profilePublicID = req.body.pubId;
    const skip = req.body.skip;
    const limit = 10;
    const stat = req.body.stat;

    const allowedStats = ['following', 'followers']

    if (!allowedStats.includes(stat)) {
        return HTTPHandler.badInput(res, `${stat} is not a valid stat`)
    }

    if (typeof skip !== 'number') {
        return HTTPHandler.badInput(res, `skip must be a number. Provided type: ${typeof skip}`)
    }

    if (typeof profilePublicID !== 'string') {
        return HTTPHandler.badInput(res, `profilePublicId must be a string. Provided type: ${typeof profilePublicId}`)
    }

    if (profilePublicID.length == 0) {
        return HTTPHandler.badInput(res, 'profilePublicID cannot be an empty string.')
    }

    const sendItemsToUser = (array, userRequesting) => {
        const {items, noMoreItems} = arrayHelper.returnSomeItems(array, skip, limit)
        console.log('Items after going though array helper:', items)
        console.log('no more items:', noMoreItems)

        User.find({secondId: {$in: items}}).then(items => {
            const newItems = [];
            for (let i = 0; i < items.length; i++) {
                newItems.push(userHandler.returnPublicInformation(items[i], userRequesting))
            }

            HTTPHandler.OK(res, 'Successfully retrieved data', {items: newItems, noMoreItems})
        }).catch(error => {
            console.error('An error occured while finding users with a secondId that is inside of an array. The array is:', items, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding users. Please try again later.')
        })
    }

    const wrongPermissions = (stat) => {
        HTTPHandler.forbidden(res, `User's privacy settings do not allow you to see ${stat === 'following' ? 'who they follow' : 'who follows them'}`)
    }

    User.findOne({_id: {$eq: userRequestingID}}).lean().then(userRequesting => {
        if (userRequesting) {
            User.findOne({secondId: {$eq: profilePublicID}}).lean().then(profileRequested => {
                if (profileRequested) {
                    const setting = stat == 'following' ? profileRequested?.settings?.privacySettings?.viewFollowing || 'followers' : profileRequested?.settings?.privacySettings?.viewFollowers || 'followers'
                    console.log('Settings is:', setting)

                    if (userRequestingID === profileRequested._id.toString() || setting === 'everyone') {
                        return sendItemsToUser(stat == 'following' ? profileRequested.following : profileRequested.followers, userRequesting)
                    }

                    if (setting == 'no-one') {
                        return wrongPermissions(stat)
                    }

                    //Setting must be followers since if they were no-one or everyone the code would've returned by now
                    const pubIdIndex = profileRequested.followers.findIndex(x => x === userRequesting.secondId);
                    const isFollower = pubIdIndex !== -1;
                    console.log('isFollower:', isFollower, '   |   pubIdIndex:', pubIdIndex)

                    if (isFollower) {
                        return sendItemsToUser(stat == 'following' ? profileRequested.following : profileRequested.followers, userRequesting)
                    } else {
                        return wrongPermissions(stat)
                    }
                } else {
                    HTTPHandler.notFound(res, 'Could not find requested profile')
                }
            }).catch(error => {
                console.error('An error occured while finding user with secondId:', profilePublicID, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }
    }).catch(error => {
        console.error('An error occured while finding user with id:', userRequestingID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding the user. Please try again later.')
    })
})

router.get('/loginactivity', rateLimiters['/loginactivity'], (req, res) => {
    const userId = req.tokenData;

    User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with userId provided.')
        }

        RefreshToken.find({admin: false, userId}).lean().then(encryptedRefreshTokens => {
            const refreshTokens = []

            for (let i = 0; i < encryptedRefreshTokens.length; i++) {
                let decryptedToken = `Bearer ${refreshTokenDecryption(encryptedRefreshTokens[i].encryptedRefreshToken)}`
                if (decryptedToken == req.headers["auth-refresh-token"]) {
                    refreshTokens.unshift({refreshTokenId: encryptedRefreshTokens[i]._id, currentDevice: true, location: encryptedRefreshTokens[i].location, IP: encryptedRefreshTokens[i].IP, deviceType: encryptedRefreshTokens[i].deviceType, loginTime: encryptedRefreshTokens[i].createdAt})
                } else {
                    refreshTokens.push({refreshTokenId: encryptedRefreshTokens[i]._id, currentDevice: false, location: encryptedRefreshTokens[i].location, IP: encryptedRefreshTokens[i].IP, deviceType: encryptedRefreshTokens[i].deviceType, loginTime: encryptedRefreshTokens[i].createdAt})
                }
            }

            HTTPHandler.OK(res, 'Found devices logged in to your account', refreshTokens)
        }).catch(error => {
            console.error('An error occurred while finding refresh tokens with admin set to false and userId set to:', userId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding refresh tokens. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/logoutdevice', rateLimiters['/logoutdevice'], (req, res) => {
    const userId = req.tokenData;
    const {tokenToLogout} = req.body;

    if (typeof tokenToLogout !== 'string') {
        return HTTPHandler.badInput(res, `tokenToLogout must be a string. Provided type: ${typeof tokenToLogout}`)
    }

    if (tokenToLogout.length == 0) {
        return HTTPHandler.badInput(res, 'tokenToLogout cannot be an empty string.')
    }

    User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'User could not be found with provided userId')
        }

        RefreshToken.deleteOne({userId: {$eq: userId}, admin: false, _id: {$eq: tokenToLogout}}).then(result => {
            if (result.deletedCount === 1) {
                HTTPHandler.OK(res, 'Successfully logged device out of your account.')
            } else {
                HTTPHandler.notFound(res, 'Could not find refresh token.')
            }
        }).catch(error => {
            console.error('An error occurred while deleting one refresh token with userId set to:', userId, ', admin set to false, and _id set to:', tokenToLogout, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while logging user out of account. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/logoutallotherdevices', rateLimiters['/logoutallotherdevices'], (req, res) => {
    const userId = req.tokenData;
    const {tokenIdNotToLogout} = req.body;

    if (typeof tokenIdNotToLogout !== 'string' && tokenIdNotToLogout !== null) {
        return HTTPHandler.badInput(res, `tokenIdNotToLogout must be a string or null. Provided type: ${typeof tokenIdNotToLogout}`)
    }

    const query = {userId};

    if (typeof tokenIdNotToLogout === 'string') {
        query._id = {$ne: tokenIdNotToLogout}
    }

    User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with userId provided.')
        }

        RefreshToken.deleteMany(query).then(() => {
            HTTPHandler.OK(res, 'Successfully logged all other devices out of your account')
        }).catch(error => {
            console.error('An error occurred while deleting all refresh tokens by this query:', query, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while logging all other devices out of your account. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.get('/loginActivitySettings', rateLimiters['/loginActivitySettings'], (req, res) => {
    const userId = req.tokenData;

    const defaults = {
        getIP: false,
        getDeviceType: false,
        getLocation: false
    }

    User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'User with userId could not be found')
        }

        const settings = {...defaults, ...userFound?.settings?.loginActivitySettings || {}}

        HTTPHandler.OK(res, 'Found settings', settings)
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/uploadLoginActivitySettings', rateLimiters['/uploadLoginActivitySettings'], (req, res) => {
    const userId = req.tokenData;
    const {newSettings} = req.body;

    if (typeof newSettings !== 'object') {
        return HTTPHandler.badInput(res, `newSettings must be an object. Provided type: ${typeof newSettings}`)
    }

    if (Array.isArray(newSettings)) {
        return HTTPHandler.badInput(res, 'newSettings must be an object. An array was provided.')
    }

    if (newSettings === null) {
        return HTTPHandler.badInput(res, 'newSettings must be an object. null was provided.')
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

        const loginActivitySettingsToSet = {...userFound?.settings?.loginActivitySettings || {}, ...newSettings}
        const settingsToSet = {...userFound?.settings || {}, loginActivitySettings: loginActivitySettingsToSet}

        User.findOneAndUpdate({_id: {$eq: userId}}, {settings: settingsToSet}).then(() => {
            HTTPHandler.OK(res, 'Changed settings successfully')
        }).catch(error => {
            console.error('An error occurred while updating user settings. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while updating login activity settings. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

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