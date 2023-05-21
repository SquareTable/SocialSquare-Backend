const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const mongodb = require('mongodb');
mongoose.set('useFindAndModify', false);
const geoIPLite = require('geoip-lite')

const sanitizeFilename = require('sanitize-filename');

const ImageLibrary = require('../libraries/Image')
const imageHandler = new ImageLibrary();
const UserLibrary = require('../libraries/User')
const userHandler = new UserLibrary();
const ArrayLibrary = require('../libraries/Array')
const arrayHelper = new ArrayLibrary();
const ImagePostLibrary = require('../libraries/ImagePost')
const imagePostHandler = new ImagePostLibrary();
const PollPostLibrary = require('../libraries/PollPost');
const pollPostHandler = new PollPostLibrary();
const ThreadPostLibrary = require('../libraries/ThreadPost');
const threadPostHandler = new ThreadPostLibrary();
const HTTPLibrary = require('../libraries/HTTP');
const HTTPHandler = new HTTPLibrary();

const DEFAULTS = require('../defaults');
const CONSTANTS = require('../constants');

//require('dotenv').config();
const fs = require('fs')
const S3 = require('aws-sdk/clients/s3')

const { generateTwoDigitDate } = require('./../generateTwoDigitDate')

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

// Password handler
const bcrypt = require('bcrypt');

const { setCacheItem } = require('../memoryCache.js')

// Use axios to make HTTP GET requests to random.org to get random base-16 strings for account verification codes
const axios = require('axios')

// Use .env file for email configuration
//require('dotenv').config();

const { blurEmailFunction, mailTransporter } = require('../globalFunctions.js')


//Web Token Stuff

const { tokenValidation, refreshTokenDecryption } = require("../middleware/TokenHandler");

router.all("*", [tokenValidation]); // the * just makes it that it affects them all it could be /whatever and it would affect that only

//Notification stuff

const { sendNotifications } = require("../notificationHandler");
const RefreshToken = require('../models/RefreshToken');
const PopularPosts = require('../models/PopularPosts');

const rateLimiters = {
    '/postimagethread': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have created too many image thread posts in the last 24 hours. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getthreadsfromcategory/:categorytitle': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many threads from a certain category in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getthreadsfromprofile': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many threads from a certain user in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/upvotethread': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 45,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have upvoted too many threads in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/downvotethread': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 45,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have downvoted too many threads in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/threadpostcomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have commented on thread posts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/threadpostcommentreply': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have replied to comments on thread posts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchforthreadcomments/:sentthreadid': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many comments on thread posts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getsinglethreadcomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many single thread comments in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchforthreadcommentreplies': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many thread comments replies in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getthreadbyid/:threadid': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many threads in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/deletethread': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have deleted too many threads in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/upvotecomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have upvoted too many comments in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/downvotecomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have upvoted too many comments in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/toggleFollowOfAUser': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 6,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have toggled following of users too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/reloadUsersDetails/:usersPubId': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have reloaded user details too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/earnSpecialBadge': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 3,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You can only earn 3 special badges a day. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getuserbyid': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many users by their id in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/makeaccountprivate': rateLimit({
        windowMs: 1000 * 60 * 60, //1 hour
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have made your account private too many times in the last hour. Please try again in 60 minutes."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/makeaccountpublic': rateLimit({
        windowMs: 1000 * 60 * 60, //1 hour
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have made your account public too many times in the last hour. Please try again in 60 minutes."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getfollowrequests': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested your follow requests too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/denyfollowrequest': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have denied too many follow requests in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/acceptfollowrequest': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have accepted too many follow requests in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/removefollowerfromaccount': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have accepted too many follow requests in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/blockaccount': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have blocked too many accounts in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getuserblockedaccounts': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested your blocked accounts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/unblockaccount': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have unblocked too many accounts in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/enableAlgorithm': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 3,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have enabled the algorithm too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getAuthenticationFactorsEnabled': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested your authentication factors too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/disableAlgorithm': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 3,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have disabled the algorithm too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/reloadProfileEssentials': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have refreshed your profile essentials too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
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

//THREAD AREA

//Post Image
router.post('/postimagethread', rateLimiters['/postimagethread'], upload.single('image'), async (req, res) => {
    const creatorId = req.tokenData;
    let {threadTitle, threadSubtitle, threadTags, threadCategory, threadImageDescription, threadNSFW, threadNSFL, sentAllowScreenShots} = req.body;

    if (!req.file) {
        return HTTPHandler.badInput(res, 'No file sent.')
    }

    const deleteImage = () => {
        imageHandler.deleteImage(req.file.path)
    }

    if (typeof threadTitle !== 'string') {
        deleteImage()
        return HTTPHandler.badInput(res, `threadTitle must be a string. Provided type: ${typeof threadTitle}`)
    }

    if (typeof threadSubtitle !== 'string') {
        deleteImage()
        return HTTPHandler.badInput(res, `threadSubtitle must be a string. Provided type: ${typeof threadSubtitle}`)
    }

    if (typeof threadTags !== 'string') {
        deleteImage()
        return HTTPHandler.badInput(res, `threadTags must be a string. Provided type: ${typeof threadTags}`)
    }

    if (typeof threadCategory !== 'string') {
        deleteImage()
        return HTTPHandler.badInput(res, `threadCategory must be a string. Provided type: ${typeof threadCategory}`)
    }

    if (typeof threadImageDescription !== 'string') {
        deleteImage()
        return HTTPHandler.badInput(res, `threadImageDescription must be a string. Provided type: ${typeof threadImageDescription}`)
    }

    if (typeof threadNSFW !== 'boolean' && threadNSFW !== "false" && threadNSFW !== "true") {
        deleteImage()
        return HTTPHandler.badInput(res, 'threadNSFW must either be a boolean, or "false", or "true"')
    }

    if (typeof threadNSFL !== 'boolean' && threadNSFL !== "false" && threadNSFL !== "true") {
        deleteImage()
        return HTTPHandler.badInput(res, 'threadNSFL must either be a boolean, or "false", or "true"')
    }

    if (typeof sentAllowScreenShots !== 'boolean' && sentAllowScreenShots !== "false" && sentAllowScreenShots !== "true") {
        deleteImage()
        return HTTPHandler.badInput(res, 'sentAllowScreenShots must either be a boolean, or "false", or "true"')
    }

    if (threadNSFW === "false") {
        threadNSFW = false
    }

    if (threadNSFW === "true") {
        threadNSFW = true
    }

    if (threadNSFL === "false") {
        threadNSFL = false
    }

    if (threadNSFL === "true") {
        threadNSFL = true
    }

    if (sentAllowScreenShots === "false") {
        sentAllowScreenShots = false
    }

    if (sentAllowScreenShots === "true") {
        sentAllowScreenShots = true
    }

    threadTitle = threadTitle.trim();
    threadSubtitle = threadSubtitle.trim();
    threadTags = threadTags.trim();
    threadCategory = threadCategory.trim();
    threadImageDescription = threadImageDescription.trim();

    if (threadTitle.length > 30 || threadTitle.length == 0) {
        deleteImage()
        return HTTPHandler.badInput(res, 'threadTitle must be between 1 and 30 characters long.')
    }

    if (threadSubtitle.length > 30 || threadSubtitle.length == 0) {
        deleteImage()
        return HTTPHandler.badInput(res, 'threadSubtitle must be between 1 and 30 characters long.')
    }

    if (threadTags.length > 60) {
        deleteImage()
        return HTTPHandler.badInput(res, 'threadTags must not be longer than 60 characters')
    }

    if (threadImageDescription.length > 1000 || threadImageDescription.length == 0) {
        deleteImage()
        return HTTPHandler.badInput(res, 'threadImageDescription must be between 1 and 1000 characters long')
    }

    console.log('File has been recieved: ', req.file.filename)
    console.log(creatorId)
    User.find({_id: {$eq: creatorId}}).then(result => {
        if (result.length) {
            Category.find({categoryTitle: {$eq: threadCategory}}).then(data => {
                if (data.length) {
                    const categoryNSFW = data[0].NSFW;
                    const categoryNSFL = data[0].NSFL;

                    if (threadNSFW && !categoryNSFW && !categoryNSFL) {
                        deleteImage()
                        return HTTPHandler.forbidden(res, 'NSFW thread posts cannot be posted in non-NSFW categories.')
                    }

                    if (threadNSFL && !categoryNSFL) {
                        deleteImage()
                        return HTTPHandler.forbidden(res, 'NSFL thread posts cannot be posted in non-NSFL categories.')
                    }

                    imageHandler.compressImage(req.file.filename).then(imageKey => {
                        const newThread = new Thread({
                            threadType: "Images",
                            comments: [],
                            creatorId: creatorId,
                            threadTitle: threadTitle,
                            threadSubtitle: threadSubtitle,
                            threadTags: threadTags,
                            threadCategory: threadCategory,
                            threadBody: "",
                            threadImageKey: imageKey,
                            threadImageDescription: threadImageDescription,
                            threadNSFW: threadNSFW,
                            threadNSFL: threadNSFL,
                            datePosted: Date.now(),
                            allowScreenShots: sentAllowScreenShots
                        });

                        newThread.save().then(result => {
                            HTTPHandler.OK(res, 'Creation successful')
                        })
                        .catch(err => {
                            imageHandler.deleteImageByKey(imageKey)
                            console.error('An error occurred while saving a new thread post with an image to the database:', err)
                            HTTPHandler.serverError(res, 'An error occurred while saving image thread. Please try again later.')
                        })
                    }).catch(error => {
                        console.error('An error was thrown from ImageLibrary.compressImage while compressing image with filename:', req.file.filename, '. The error was:', error)
                        imageHandler.deleteImage(req.file.path)
                        HTTPHandler.serverError(res, 'Failed to compress image')
                    })
                } else {
                    imageHandler.deleteImage(req.file.path)
                    HTTPHandler.notFound(res, 'Category could not be found')
                }
            }).catch(error => {
                imageHandler.deleteImage(req.file.path)
                console.error('An error occured while finding category with title:', threadCategory, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding the category. Plesae try again later.')
            })
        } else {
            imageHandler.deleteImage(req.file.path)
            HTTPHandler.notFound(res, 'Could not find user with creatorId')
        }
    }).catch(error => {
        imageHandler.deleteImage(req.file.path)
        console.error('An error occurred while finding user with ID: ', creatorId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

//Get Threads From Category
router.get('/getthreadsfromcategory/:categorytitle', rateLimiters['/getthreadsfromcategory/:categorytitle'], (req, res) => {
    let categorytitle = req.params.categorytitle
    const userid = req.tokenData;
    console.log("yes")
    console.log(userid)
    User.findOne({_id: {$eq: userid}}).lean().then(userRequesting => {
        if (userRequesting) {
            Category.find({categoryTitle: {$eq: categorytitle}}).lean().then(data =>{ 
                if (data.length) {
                    Thread.find({threadCategory: {$eq: categorytitle}}).lean().then(result => {
                        if (result.length) {
                            Promise.all(
                                result.map((item, index) => User.find({_id: result[index].creatorId})).lean()
                            ).then(users => Promise.all(
                                users.map((user, index) => {
                                    return new Promise((resolve, reject) => {
                                        if (user) {
                                            threadPostHandler.processMultiplePostDataFromOneOwner(result[index], user, userRequesting).then(posts => posts[0]).then(post => {
                                                resolve(post)
                                            }).catch(error => {
                                                console.error(error)
                                                reject('Error occured (error log above)')
                                            })
                                        } else {
                                            console.log("A user does not exist but the thread does.")
                                            console.log('The expected user id:', result[index].creatorId)
                                            resolve('USER_DOES_NOT_EXIST')
                                        }
                                    })
                                })
                            )).then(posts => {
                                const filteredPosts = posts.filter(post => post !== 'USER_DOES_NOT_EXIST')
                                HTTPHandler.OK(res, 'Posts found', filteredPosts)
                            }).catch(error => {
                                console.error('An error occured while finding users for threads from a category. The error was:', error)
                                HTTPHandler.serverError(res, 'An error occurred while getting threads. Please try again later.')
                            })
                        } else {
                            HTTPHandler.notFound(res, 'This category does not have any threads.')
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding all threads from category with title:', categorytitle, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding threads. Please try again later.')
                    })
                } else {
                    HTTPHandler.notFound(res, 'Category could not be found')
                }
            }).catch(error => {
                console.error('An error occurred while finding category with category title:', categorytitle, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding category. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'User could not be found')
        }
    }).catch(error => {
        console.error('An error occured while finding user with id:', userid, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

//Get Threads From profile
router.post('/getthreadsfromprofile', rateLimiters['/getthreadsfromprofile'], (req, res) => {
    const pubId = req.body.pubId;
    const sentuserid = req.tokenData;
    console.log(pubId)
    User.find({secondId: {$eq: pubId}}).lean().then(userResult => {
        if (userResult.length) {
            User.find({_id: {$eq: sentuserid}}).lean().then(userRequestingThreads => {
                if (userRequestingThreads.length && !userResult[0].blockedAccounts.includes(userRequestingThreads[0].secondId)) {
                    if (userResult[0].privateAccount && !userResult[0].followers.includes(userRequestingThreads[0].secondId)) {
                        return HTTPHandler.notFound(res, 'This user has no thread posts!')
                    }
                    var userid = userResult[0]._id
                    console.log("user id:")
                    console.log(userid)
                    Thread.find({creatorId: {$eq: userid}}).sort({datePosted: -1}).lean().then(result => {
                        if (result.length) {
                            threadPostHandler.processMultiplePostDataFromOneOwner(result, userResult[0], userRequestingThreads[0]).then(posts => {
                                HTTPHandler.OK(res, 'Posts found', posts)
                            }).catch(error => {
                                console.error('An error occurred while processing thread posts. The error was:', error)
                                HTTPHandler.serverError(res, 'An error occurred while getting thread posts. Please try again later.')
                            })
                        } else {
                            HTTPHandler.notFound(res, 'This user has no thread posts!')
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding threads with creatorId:', userid, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding threads. Please try again later.')
                    })
                } else {
                    HTTPHandler.notFound(res, 'User not found.')
                }
            }).catch(error => {
                console.error('An error occurred while finding user with id:', sentuserid, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'Could not find user provided.')
        }
    }).catch(err => {
        console.error('An error occurred while finding user with secondId:', pubId, '. The error was:', err)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

//UpVote Thread
router.post('/upvotethread', rateLimiters['/upvotethread'], (req, res) => {
    const userId = req.tokenData;
    let {threadId} = req.body;

    if (typeof threadId !== 'string') {
        return HTTPHandler.badInput(res, `threadId must be a string. Provided type: ${typeof threadId}`)
    }

    //Find User
    User.findOne({_id: {$eq: userId}}).lean().then(result => {
        if (result) {
            Thread.findOne({_id: {$eq: threadId}}).lean().then(data => {
                if (data) {
                    threadPostHandler.upvote(data, result).then(successMessage => {
                        HTTPHandler.OK(res, successMessage)
                    }).catch(error => {
                        if (error.privateError) {
                            console.error('An error occured while upvoting thread. The error was:', error)
                        }
                        res.json({
                            status: "FAILED",
                            message: error.publicError
                        })
                        HTTPHandler.serverError(res, error.publicError)
                    })
                } else {
                    HTTPHandler.notFound(res, 'Thread not found')
                }
            }).catch(error => {
                console.error('An error occured while finding thread with id:', threadId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding thread. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'User not found')
        }
    }).catch(error => {
        console.error('An error occurred while finding a user with id:', userId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

//DownVote Thread
router.post('/downvotethread', rateLimiters['/downvotethread'], (req, res) => {
    const userId = req.tokenData;
    let {threadId} = req.body;

    if (typeof threadId !== 'string') {
        return HTTPHandler.badInput(res, `threadId must be a string. Provided type: ${typeof threadId}`)
    }

    //Find User
    User.findOne({_id: {$eq: userId}}).lean().then(result => {
        if (result) {
            Thread.findOne({_id: {$eq: threadId}}).lean().then(data => {
                if (data) {
                    threadPostHandler.downvote(data, result).then(successMessage => {
                        HTTPHandler.OK(res, successMessage)
                    }).catch(error => {
                        if (error.privateError) {
                            console.error('An error occured while downvoting thread. The error was:', error)
                        }
                        HTTPHandler.serverError(res, error.publicError)
                    })
                } else {
                    HTTPHandler.notFound(res, 'Thread not found')
                }
            }).catch(error => {
                console.error('An error occured while finding thread with id:', threadId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding thread. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'User not found')
        }
    }).catch(error => {
        console.error('An error occured while finding a user with id:', userId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

//Poll Comment Post
router.post('/threadpostcomment', rateLimiters['/threadpostcomment'], (req, res) => {
    const userId = req.tokenData;
    let {comment, userName, threadId} = req.body;

    if (typeof comment !== 'string') {
        return HTTPHandler.badInput(res, `comment must be a string. Provided type: ${typeof comment}`)
    }

    if (typeof userName !== 'string') {
        return HTTPHandler.badInput(res, `userName must be a string. Provided type: ${typeof userName}`)
    }

    if (typeof threadId !== 'string') {
        return HTTPHandler.badInput(res, `threadId must be a string. Provided type: ${typeof threadId}`)
    }

    comment = comment.trim();

    if (comment.length == 0) {
        return HTTPHandler.badInput(res, 'comment cannot be blank')
    }

    if (comment.length > 1000) {
        return HTTPHandler.badInput(res, 'comment must not be more than 1000 characters long')
    }

    //Find User
    User.find({_id: {$eq: userId}}).then(result => {
        if (result.length) {
            if (result[0].name == userName) {
                async function findThreads() {
                    var objectId = new mongodb.ObjectID()
                    console.log(objectId)
                    var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], commentReplies: [], datePosted: Date.now()}
                    Thread.findOneAndUpdate({_id: {$eq: threadId}}, { $push: { comments: commentForPost } }).then(function(){
                        console.log("SUCCESS1")
                        HTTPHandler.OK(res, 'Comment upload successful')
                    })
                    .catch(err => {
                        console.error('An error occurred while adding comment object:', commentForPost, "to thread's comments with id:", threadId, '. The error was:', err)
                        HTTPHandler.serverError(res, 'An error occurred while adding comment to post. Please try again later.')
                    });
                }
                findThreads()
            } else {
                HTTPHandler.notFound(res, 'name in database does not match up with userName')
            }
        } else {
            HTTPHandler.notFound(res, 'Could not find user with your userId')
        } 
    })
    .catch(err => {
        console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    });
})

//Thread Comment Reply Post
router.post('/threadpostcommentreply', rateLimiters['/threadpostcommentreply'], (req, res) => {
    const userId = req.tokenData;
    let {comment, userName, threadId, commentId} = req.body;

    if (typeof comment !== 'string') {
        return HTTPHandler.badInput(res, `comment must be a string. Provided type: ${typeof comment}`)
    }

    if (typeof userName !== 'string') {
        return HTTPHandler.badInput(res, `userName must be a string. Provided type: ${typeof userName}`)
    }

    if (typeof threadId !== 'string') {
        return HTTPHandler.badInput(res, `threadId must be a string. Provided type: ${typeof threadId}`)
    }

    if (typeof commentId !== 'string') {
        return HTTPHandler.badInput(res, `commentId must be a string. Provided type: ${typeof commentId}`)
    }

    comment = comment.trim();

    if (comment.length == 0) {
        return HTTPHandler.badInput(res, 'comment cannot be blank')
    }

    if (comment.length > 1000) {
        return HTTPHandler.badInput(res, 'comment cannot be more than 1000 characters')
    }

    //Find User
    User.find({_id: {$eq: userId}}).then(result => {
        if (result.length) {
            if (result[0].name == userName) {
                Thread.find({_id: {$eq: threadId}}).then(data => {
                    if (data.length) {
                        var comments = data[0].comments
                        async function findThreads(sentIndex) {
                            var objectId = new mongodb.ObjectID()
                            console.log(objectId)
                            var commentForPost = {commentId: objectId, commenterId: userId, commentsText: comment, commentUpVotes: [], commentDownVotes: [], datePosted: Date.now()}
                            Thread.findOneAndUpdate({_id: {$eq: threadId}}, { $push: { [`comments.${sentIndex}.commentReplies`]: commentForPost } }).then(function(){
                                console.log("SUCCESS1")
                                HTTPHandler.OK(res, 'Comment upload successful')
                            })
                            .catch(err => {
                                console.error('An error occurred while pushing:', commentForPost, 'to:', `comments.${sentIndex}.commentReplies`, ' for thread with id:', threadId, '. The error was:', err)
                                HTTPHandler.serverError(res, 'An error occurred while adding comment. Please try again later.')
                            });
                        }
                        var itemsProcessed = 0
                        comments.forEach(function (item, index) {
                            console.log(comments[index].commentId)
                            console.log(commentId)
                            if (comments[index].commentId == commentId) {
                                if (itemsProcessed !== null) {
                                    console.log("Found at index:")
                                    console.log(index)
                                    findThreads(index)
                                    itemsProcessed = null
                                }
                            } else {
                                if (itemsProcessed !== null) {
                                    itemsProcessed++;
                                    if(itemsProcessed == comments.length) {
                                        HTTPHandler.notFound(res, "Couldn't find comment")
                                    }
                                }
                            }
                        });
                    } else {
                        HTTPHandler.notFound(res, 'Could not find thread')
                    }
                }).catch(error => {
                    console.error('An error occurred while finding thread with id:', threadId, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding thread. Please try again later.')
                })
            } else {
                HTTPHandler.badInput(res, 'name in database does not match up with userName provided')
            }
        } else {
            HTTPHandler.notFound(res, 'Could not find user with provided user id')
        } 
    })
    .catch(err => {
        console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    });
})

//search for thread comments
router.get('/searchforthreadcomments/:sentthreadid', rateLimiters['/searchforthreadcomments/:sentthreadid'], (req, res) => {
    let sentThreadId = req.params.sentthreadid
    const sentUserId = req.tokenData;

    if (typeof sentThreadId !== 'string') {
        return HTTPHandler.badInput(res, `sentThreadId must be a string. Provided type: ${typeof sentThreadId}`)
    }

    if (sentThreadId.length == 0) {
        return HTTPHandler.badInput(res, 'sentThreadId cannot be blank.')
    }

    //Find User
    console.log(sentThreadId)
    function sendResponse(nameSendBackObject) {
        console.log("Params Recieved")
        console.log(nameSendBackObject)
        HTTPHandler.OK(res, 'Comment search successful', nameSendBackObject)
    }
    async function findThreads() {
        await Thread.find({_id: {$eq: sentThreadId}}).then(data => {
            if (data.length) {
                var nameSendBackObject = [];
                var comments = data[0].comments;
                if (comments.length == 0) {
                    HTTPHandler.notFound(res, 'This thread post has no comments')
                } else {
                    var itemsProcessed = 0;
                    console.log(comments)
                    comments.forEach(function (item, index) {
                        User.find({_id: comments[index].commenterId}).then(result => {
                            if (result.length) {
                                console.log(data)
                                console.log(data[0].comments[index].commentText)
                                var commentUpVotes = (data[0].comments[index].commentUpVotes.length - data[0].comments[index].commentDownVotes.length)
                                var commentUpVoted = false
                                if (data[0].comments[index].commentUpVotes.includes(sentUserId)) {
                                    commentUpVoted = true
                                }
                                var commentDownVoted = false
                                if (data[0].comments[index].commentDownVotes.includes(sentUserId)) {
                                    commentDownVoted = true
                                }
                                nameSendBackObject.push({commentId: data[0].comments[index].commentId, commenterName: result[0].name, commenterDisplayName: result[0].displayName, commentText: data[0].comments[index].commentsText, commentUpVotes: commentUpVotes, commentDownVotes: data[0].comments[index].commentDownVotes, commentReplies: data[0].comments[index].commentReplies.length, datePosted: data[0].comments[index].datePosted, profileImageKey: result[0].profileImageKey, commentUpVoted: commentUpVoted, commentDownVoted: commentDownVoted})
                            } else {
                                console.error('A comment was found on thread post with id:', sentThreadId, " and the comment creator cannot be found. The comment creator's id is:", comments[index].commenterId)
                                return HTTPHandler.serverError(res, 'An error occurred while checking for comment creator')
                            }
                            itemsProcessed++;
                            if(itemsProcessed === comments.length) {
                                console.log("Before Function")
                                console.log(nameSendBackObject)
                                sendResponse(nameSendBackObject);
                            }
                        }).catch(error => {
                            console.error('An error occurred whole finding user with id:', comments[index].commenterId, '. The error was:', error)
                            return HTTPHandler.serverError(res, 'An error occurred while finding comment creator. Please try again later.')
                        })
                    })
                }
            } else {
                HTTPHandler.notFound(res, 'Thread could not be found')
            }
        })
        .catch(err => {
            console.error('An error occurred while finding thread with id:', sentThreadId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding thread. Please try again later.')
        });
    }
    findThreads()
})

//search for thread comments
router.post('/getsinglethreadcomment', rateLimiters['/getsinglethreadcomment'], (req, res) => {
    const sentUserId = req.tokenData;
    const sentThreadId = req.body.postId;
    const sentCommentId = req.body.commentId;

    if (typeof sentThreadId !== 'string') {
        return HTTPHandler.badInput(res, `sentThreadId must be a string. Provided type: ${typeof sentThreadId}`)
    }

    if (typeof sentUserId !== 'string') {
        return HTTPHandler.badInput(res, `sentUserId must be a string. Provided type: ${typeof sentUserId}`)
    }

    if (typeof sentCommentId !== 'string') {
        return HTTPHandler.badInput(res, `sentCommentId must be a string. Provided type: ${typeof sentCommentId}`)
    }

    if (sentThreadId.length == 0) {
        return HTTPHandler.badInput(res, 'sentThreadId must not be blank.')
    }

    if (sentUserId.length == 0) {
        return HTTPHandler.badInput(res, 'sentUserId must not be blank.')
    }

    if (sentCommentId.length == 0) {
        return HTTPHandler.badInput(res, 'sentCommentId must not be blank.')
    }

    //Find User
    console.log(sentThreadId)
    function sendResponse(nameSendBackObject) {
        console.log("Params Recieved")
        console.log(nameSendBackObject)
        HTTPHandler.OK(res, 'Comment search successful', nameSendBackObject)
    }
    async function findThreads() {
        await Thread.find({_id: {$eq: sentThreadId}}).then(data => {
            if (data.length) {
                var comments = data[0].comments
                var nameSendBackObject = [];
                if (comments.length == 0) {
                    HTTPHandler.notFound(res, 'No comments')
                } else {
                    function forAwaits(index) {
                        User.find({_id: comments[index].commenterId}).then(result => {
                            if (result.length) {
                                var commentUpVotes = (data[0].comments[index].commentUpVotes.length - data[0].comments[index].commentDownVotes.length)
                                var commentUpVoted = false
                                if (data[0].comments[index].commentUpVotes.includes(sentUserId)) {
                                    commentUpVoted = true
                                }
                                var commentDownVoted = false
                                if (data[0].comments[index].commentDownVotes.includes(sentUserId)) {
                                    commentDownVoted = true
                                }
                                nameSendBackObject.push({commentId: data[0].comments[index].commentId, commenterName: result[0].name, commenterDisplayName: result[0].displayName, commentText: data[0].comments[index].commentsText, commentUpVotes: commentUpVotes, commentDownVotes: data[0].comments[index].commentDownVotes, commentReplies: data[0].comments[index].commentReplies.length, datePosted: data[0].comments[index].datePosted, profileImageKey: result[0].profileImageKey, commentUpVoted: commentUpVoted, commentDownVoted: commentDownVoted})
                                sendResponse(nameSendBackObject)
                            } else {
                                HTTPHandler.notFound(res, 'Could not find user')
                            }
                        }).catch(error => {
                            console.error('An error occurred while finding user with id:', comments[index].commenterId, '. The error was:', error)
                            HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
                        })
                    }
                    var itemsProcessed  = 0
                    comments.forEach(function (item, index) {
                        console.log(comments[index].commentId)
                        if (comments[index].commentId == sentCommentId) {
                            if (itemsProcessed !== null) {
                                console.log("Found at index:")
                                console.log(index)
                                forAwaits(index)
                                itemsProcessed = null
                            }
                        } else {
                            if (itemsProcessed !== null) {
                                itemsProcessed++;
                                if(itemsProcessed == comments.length) {
                                    HTTPHandler.notFound(res, 'Could not find comment')
                                }
                            }
                        }
                    });
                }
            } else {
                HTTPHandler.notFound(res, 'Could not find thread')
            }
        })
        .catch(err => {
            console.error('An error occurred while finding thread with id:', sentThreadId, '. The error was:', err)
            HTTPHandler.serverError(res, 'An error occurred while finding thread. Please try again later.')
        });
    }
    findThreads()
})

//search for thread comments
router.post('/searchforthreadcommentreplies', rateLimiters['/searchforthreadcommentreplies'], (req, res) => {
    const sentUserId = req.tokenData;
    const sentThreadId = req.body.postId;
    const sentCommentId = req.body.commentId;

    if (typeof sentThreadId !== 'string') {
        return HTTPHandler.badInput(res, `sentThreadId must be a string. Provided type: ${typeof sentThreadId}`)
    }

    if (typeof sentCommentId !== 'string') {
        return HTTPHandler.badInput(res, `sentCommentId must be a string. Provided type: ${typeof sentCommentId}`)
    }

    if (typeof sentUserId !== 'string') {
        return HTTPHandler.badInput(res, `sentUserId must be a string. Provided type: ${typeof sentUserId}`)
    }

    if (sentThreadId.length == 0) {
        return HTTPHandler.badInput(res, 'sentThreadId cannot be blank')
    }

    if (sentCommentId.length == 0) {
        return HTTPHandler.badInput(res, 'sentCommentId cannot be blank')
    }

    if (sentUserId.length == 0) {
        return HTTPHandler.badInput(res, 'sentUserId cannot be blank')
    }


    //Find User
    console.log(sentThreadId)
    function sendResponse(nameSendBackObject) {
        console.log("Params Recieved")
        console.log(nameSendBackObject)
        HTTPHandler.OK(res, 'Comment search successful', nameSendBackObject)
    }
    async function findThreads() {
        await Thread.find({_id: {$eq: sentThreadId}}).then(data => {
            if (data.length) {
                var nameSendBackObject = [];
                var comments = data[0].comments;
                if (comments.length == 0) {
                    HTTPHandler.notFound(res, 'No comments')
                } else {
                    function forAwaits(index) {
                        var itemsProcessed = 0;
                        var commentReplies = data[0].comments[index].commentReplies;
                        if (commentReplies.length == 0) {
                            HTTPHandler.notFound(res, 'No replies')
                        } else {
                            console.log(commentReplies)
                            commentReplies.forEach(function (item, index) {
                                User.find({_id: commentReplies[index].commenterId}).then(result => {
                                    if (result.length) {
                                        console.log(data)
                                        console.log(commentReplies[index].commentText)
                                        var commentUpVotes = (commentReplies[index].commentUpVotes.length - commentReplies[index].commentDownVotes.length)
                                        var commentUpVoted = false
                                        if (commentReplies[index].commentUpVotes.includes(sentUserId)) {
                                            commentUpVoted = true
                                        }
                                        var commentDownVoted = false
                                        if (commentReplies[index].commentDownVotes.includes(sentUserId)) {
                                            commentDownVoted = true
                                        }
                                        nameSendBackObject.push({commentId: commentReplies[index].commentId, commenterName: result[0].name, commenterDisplayName: result[0].displayName, commentText: commentReplies[index].commentsText, commentUpVotes: commentUpVotes, commentDownVotes: commentReplies[index].commentDownVotes, datePosted: commentReplies[index].datePosted, profileImageKey: result[0].profileImageKey, commentUpVoted: commentUpVoted, commentDownVoted: commentDownVoted})
                                    } else {
                                        return HTTPHandler.serverError(res, 'An error occurred while checking for comment creator')
                                    }
                                    itemsProcessed++;
                                    if(itemsProcessed === commentReplies.length) {
                                        console.log("Before Function")
                                        console.log(nameSendBackObject)
                                        sendResponse(nameSendBackObject);
                                    }
                                }).catch(error => {
                                    console.error('An error occurred while finding user with id:', commentReplies[index].commenterId, '. The error was:', error)
                                    HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
                                })
                            })
                        }
                    }
                    var itemsProcessed = 0
                    comments.forEach(function (item, index) {
                        console.log(comments[index].commentId)
                        if (comments[index].commentId == sentCommentId) {
                            if (itemsProcessed !== null) {
                                console.log("Found at index:")
                                console.log(index)
                                forAwaits(index)
                                itemsProcessed = null
                            }
                        } else {
                            if (itemsProcessed !== null) {
                                itemsProcessed++;
                                if(itemsProcessed == comments.length) {
                                    HTTPHandler.notFound(res, "Couldn't find comment")
                                }
                            }
                        }
                    });
                }
            } else {
                HTTPHandler.notFound(res, 'Could not find thread')
            }
        }).catch(err => {
            console.error('An error occurred while finding thread with id:', sentThreadId, '. The error was:', err)
            HTTPHandler.serverError(res, 'An error occurred while finding thread. Please try again later.')
        });
    }
    findThreads()
})

//Get Threads With Id
router.get('/getthreadbyid/:threadid', rateLimiters['/getthreadbyid/:threadid'], (req, res) => {
    let threadId = req.params.threadid
    const userid = req.tokenData;

    if (typeof threadId !== 'string') {
        return HTTPHandler.badInput(res, `threadId must be a string. Provided type: ${typeof threadId}`)
    }

    if (threadId.length == 0) {
        return HTTPHandler.badInput(res, 'threadId cannot be blank.')
    }

    console.log(userid)
    Thread.find({_id: {$eq: threadId}}).lean().then(result => {
        if (result.length) {
            Category.find({categoryTitle: result[0].threadCategory}).lean().then(data =>{ 
                if (data.length) {
                    var categoryImageKey = data[0].imageKey
                    if (data[0].imageKey == "") {
                        categoryImageKey = null
                    }
                    User.find({_id: result[0].creatorId}).lean().then(data => {
                        if (data.length) {
                            User.findOne({_id: {$eq: userid}}).lean().then(userRequestingThread => {
                                if (userRequestingThread) {
                                    threadPostHandler.processMultiplePostDataFromOneOwner(result, data[0], userRequestingThread).then(posts => {
                                        const post = {
                                            ...posts[0],
                                            categoryImageKey
                                        }
                                        HTTPHandler.OK(res, 'Posts found', post)
                                    }).catch(error => {
                                        console.error('An error occured while processing thread. The error was:', error)
                                        HTTPHandler.serverError(res, 'An error occurred while getting thread. Please try again later.')
                                    })
                                } else {
                                    HTTPHandler.notFound(res, 'Could not find user with your id')
                                }
                            }).catch(error => {
                                console.error('An error occured while finding a user with id:', userid, '. The error was:', error)
                                HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
                            })
                        } else {
                            HTTPHandler.notFound(res, 'Could not find thread creator.')
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding user with id:', result[0].creatorId, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
                    })
                } else {
                    HTTPHandler.notFound(res, 'Could not find category.')
                }
            }).catch(error => {
                console.error('An error occurred while finding category with title:', result[0].threadCategory, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding category. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'Could not find thread')
        }
    }).catch(error => {
        console.error('An error occured while trying to find thread with id:', threadId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding thread post. Please try again later.')
    })
})

//Delete Thread
router.post('/deletethread', rateLimiters['/deletethread'], (req, res) => {
    let {threadId} = req.body;
    const userId = req.tokenData;

    if (typeof threadId !== 'string') {
        return HTTPHandler.badInput(res, `threadId must be a string. Provided type: ${typeof threadId}`)
    }

    if (threadId.length == 0) {
        return HTTPHandler.badInput(res, 'threadId cannot be blank.')
    }


    //Find User
    async function deleteThread() {
        //Confirm User
        User.find({_id: {$eq: userId}}).then(result => {
            if (result.length) {
                //User exists
                Thread.find({_id: {$eq: threadId}}).then(data => {
                    if (data.length) {
                        var findUser = data[0]
                        if (findUser.creatorId == userId) {
                            if (findUser.threadType !== "Images") {
                                Thread.deleteOne({_id: findUser._id}).then(function(){
                                    HTTPHandler.OK(res, 'Deleted')
                                    Promise.all([
                                        Upvote.deleteMany({postId: findUser._id, postFormat: 'Thread'}),
                                        Downvote.deleteMany({postId: findUser._id, postFormat: 'Thread'})
                                    ]).catch(error => {
                                        console.error('An error occured while deleting all votes from thread post with id:', findUser._id, '. The error was:', error)
                                    })
                                }).catch(err => {
                                    console.error('An error occurred while deleting thread with id:', findUser._id, '. The error was:', err)
                                    HTTPHandler.serverError(res, 'An error occurred while deleting thread. Please try again later.')
                                });
                            } else {
                                Thread.deleteOne({_id: findUser._id}).then(function(){
                                    imageHandler.deleteImageByKey(findUser.threadImageKey)
                                    Promise.all([
                                        Upvote.deleteMany({postId: findUser._id, postFormat: 'Thread'}),
                                        Downvote.deleteMany({postId: findUser._id, postFormat: 'Thread'})
                                    ]).catch(error => {
                                        console.error('An error occured while deleting all votes from thread post with id:', findUser._id, '. The error was:', error)
                                    })
                                }).catch(err => {
                                    console.error('An error occurred while deleting thread with id:', findUser._id, '. The error was:', err)
                                    HTTPHandler.serverError(res, 'An error occurred while deleting thread. Please try again later.')
                                });
                            }
                        } else {
                            HTTPHandler.forbidden(res, "You cannot delete someone else's posts")
                        }
                    } else {
                        HTTPHandler.notFound(res, 'Could not find thread')
                    }
                }).catch(error => {
                    console.error('An error occurred while finding thread with id:', threadId, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding thread. Please try again later.')
                })
            } else {
                HTTPHandler.notFound(res, 'Could not find user with provided user id')
            }
        }).catch(error => {
            console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
        })
    }
    deleteThread()
})

//UpVote Thread
router.post('/upvotecomment', rateLimiters['/upvotecomment'], (req, res) => {
    const userId = req.tokenData;
    let {format, postId, commentId} = req.body;

    const supportedFormats = ["Image", "Poll", "Thread"]

    if (!supportedFormats.includes(format)) {
        return HTTPHandler.badInput(res, `format must be either ${supportedFormats.join(', ')}`)
    }

    if (typeof postId !== 'string') {
        return HTTPHandler.badInput(res, `postId must be a string. Provided type: ${typeof postId}`)
    }

    if (typeof commentId !== 'string') {
        return HTTPHandler.badInput(res, `commentId must be a string. Provided type: ${typeof commentId}`)
    }

    if (postId.length === 0) {
        return HTTPHandler.badInput(res, 'postId cannot be blank')
    }

    if (commentId.length === 0) {
        return HTTPHandler.badInput(res, 'commentId cannot be blank')
    }

    //Find User
    async function upVoteComment() {
        //Confirm User
        User.find({_id: {$eq: userId}}).then(result => {
            if (result.length) {
                //User exists
                if (format == "Poll") {
                    Poll.find({_id: {$eq: postId}}).then(data => {
                        if (data.length) {
                            var findUser = data[0]
                            console.log(findUser)
                            console.log("Bruh")
                            console.log(findUser.creatorId)
                            console.log(userId)
                            async function forAwaits(sentIndex) { 
                                console.log(findUser.creatorId)
                                console.log(userId)
                                if (findUser.comments[sentIndex].commentUpVotes.includes(userId)) {
                                    //User has upvoted
                                    Poll.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentUpVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, "Comment UpVote removed")
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentUpVotes`, 'in poll with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing current upvote. Please try again later.')
                                    });
                                } else if (findUser.comments[sentIndex].commentDownVotes.includes(userId)) {
                                    Poll.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentDownVotes`] : userId }, $push: { [`comments.${sentIndex}.commentUpVotes`] : userId }}).then(function(){
                                        HTTPHandler.OK(res, 'Comment UpVoted')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentDownVotes`, 'and pushing:', userId, 'to:', `comments.${sentIndex}.commentUpVotes`, 'on post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while upvoting post. Please try again later.')
                                    });
                                } else {
                                    Poll.findOneAndUpdate({_id: {$eq: postId}}, { $push: { [`comments.${sentIndex}.commentUpVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, "Comment UpVoted")
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pushing:', userId, 'into:', `comments.${sentIndex}.commentUpVotes`, 'on poll with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while upvoting post. Please try again later.')
                                    });
                                }
                            }
                            var itemsProcessed = 0
                            findUser.comments.forEach(function (item, index) {
                                console.log(findUser.comments[index].commentId)
                                console.log(commentId)
                                if (findUser.comments[index].commentId == commentId) {
                                    if (itemsProcessed !== null) {
                                        console.log("Found at index:")
                                        console.log(index)
                                        forAwaits(index)
                                        itemsProcessed = null
                                    }
                                } else {
                                    if (itemsProcessed !== null) {
                                        itemsProcessed++;
                                        if(itemsProcessed == findUser.comments.length) {
                                            HTTPHandler.notFound(res, "Couldn't find comment")
                                        }
                                    }
                                }
                            });
                        } else {
                            HTTPHandler.notFound(res, 'Could not find poll post')
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding poll with id:', postId, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding poll post. Please try again later.')
                    })
                } else if (format == "Image") {
                    ImagePost.find({_id: {$eq: postId}}).then(data => {
                        if (data.length) {
                            var findUser = data[0]
                            console.log(findUser)
                            console.log("Bruh")
                            console.log(findUser.creatorId)
                            console.log(userId)
                            async function forAwaits(sentIndex) { 
                                console.log(findUser.creatorId)
                                console.log(userId)
                                if (findUser.comments[sentIndex].commentUpVotes.includes(userId)) {
                                    //User has upvoted
                                    ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentUpVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, "Comment UpVote removed")
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentUpVotes`, 'on image post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing post upvote. Please try again later.')
                                    });
                                } else if (findUser.comments[sentIndex].commentDownVotes.includes(userId)) {
                                    ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentDownVotes`] : userId}, $push: { [`comments.${sentIndex}.commentUpVotes`] : userId }}).then(function(){
                                        HTTPHandler.OK(res, "Comment UpVoted")
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pushing:', userId, 'to:', `comments.${sentIndex}.commentUpVotes`, 'and pull:', userId, 'from:', `comments.${sentIndex}.commentDownVotes`, 'on image post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing downvote and adding upvote to image post. Please try again later.')
                                    });
                                } else {
                                    ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $push: { [`comments.${sentIndex}.commentUpVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, 'Comment UpVoted')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pushing:', userId, 'to:', `comments.${sentIndex}.commentUpVotes`, 'on image post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while upvoting post. Please try again later.')
                                    });
                                }
                            }
                            var itemsProcessed = 0
                            findUser.comments.forEach(function (item, index) {
                                console.log(findUser.comments[index].commentId)
                                console.log(commentId)
                                if (findUser.comments[index].commentId == commentId) {
                                    if (itemsProcessed !== null) {
                                        console.log("Found at index:")
                                        console.log(index)
                                        forAwaits(index)
                                        itemsProcessed = null
                                    }
                                } else {
                                    if (itemsProcessed !== null) {
                                        itemsProcessed++;
                                        if(itemsProcessed == findUser.comments.length) {
                                            HTTPHandler.notFound(res, "Couldn't find comment")
                                        }
                                    }
                                }
                            });
                        } else {
                            HTTPHandler.notFound(res, 'Could not find image post.')
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding image post with id:', postId, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding image post. Please try again later.')
                    })
                } else if (format == "Thread") {
                    Thread.find({_id: {$eq: postId}}).then(data => {
                        if (data.length) {
                            var findUser = data[0]
                            console.log(findUser)
                            console.log("Bruh")
                            console.log(findUser.creatorId)
                            console.log(userId)
                            async function forAwaits(sentIndex) { 
                                console.log(findUser.creatorId)
                                console.log(userId)
                                if (findUser.comments[sentIndex].commentUpVotes.includes(userId)) {
                                    //User has upvoted
                                    Thread.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentUpVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, "Comment UpVote removed")
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentUpVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing upvote from post. Please try again later.')
                                    });
                                } else if (findUser.comments[sentIndex].commentDownVotes.includes(userId)) {
                                    Thread.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentDownVotes`] : userId }, $push: { [`comments.${sentIndex}.commentUpVotes`] : userId}}).then(function(){
                                        HTTPHandler.OK(res, 'Comment UpVoted')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentDownVotes`, 'and pushing:', userId, 'to:', `comments.${sentIndex}.commentUpVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing downvote and adding upvote to thread post. Please try again later.')
                                    });
                                } else {
                                    Thread.findOneAndUpdate({_id: {$eq: postId}}, { $push: { [`comments.${sentIndex}.commentUpVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, "Comment UpVoted")
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pushing:', userId, 'to:', `comments.${sentIndex}.commentUpVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while adding upvote to post. Please try again later.')
                                    });
                                }
                            }
                            var itemsProcessed = 0
                            findUser.comments.forEach(function (item, index) {
                                console.log(findUser.comments[index].commentId)
                                console.log(commentId)
                                if (findUser.comments[index].commentId == commentId) {
                                    if (itemsProcessed !== null) {
                                        console.log("Found at index:")
                                        console.log(index)
                                        forAwaits(index)
                                        itemsProcessed = null
                                    }
                                } else {
                                    if (itemsProcessed !== null) {
                                        itemsProcessed++;
                                        if(itemsProcessed == findUser.comments.length) {
                                            HTTPHandler.notFound(res, "Couldn't find comment")
                                        }
                                    }
                                }
                            });
                        } else {
                            HTTPHandler.notFound(res, 'Thread could not be found')
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding thread with id:', postId, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding thread post. Please try again later.')
                    })
                }
            } else {
                HTTPHandler.notFound(res, 'Could not find user with userId provided.')
            }
        }).catch(error => {
            console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
        })
    }
    upVoteComment()
})

//DownVote Thread
router.post('/downvotecomment', rateLimiters['/downvotecomment'], (req, res) => {
    let {format, postId, commentId} = req.body;
    const userId = req.tokenData;

    const supportedFormats = ["Image", "Poll", "Thread"]

    if (!supportedFormats.includes(format)) {
        return HTTPHandler.badInput(res, `format must be either ${supportedFormats.join(', ')}`)
    }

    if (typeof postId !== 'string') {
        return HTTPHandler.badInput(res, `postId must be a string. Provided type: ${typeof postId}`)
    }

    if (typeof commentId !== 'string') {
        return HTTPHandler.badInput(res, `commentId must be a string. Provided type: ${typeof commentId}`)
    }

    if (postId.length === 0) {
        return HTTPHandler.badInput(res, 'postId cannot be blank')
    }

    if (commentId.length === 0) {
        return HTTPHandler.badInput(res, 'commentId cannot be blank')
    }


    //Find User
    async function downVoteComment() {
        //Confirm User
        User.find({_id: {$eq: userId}}).then(result => {
            if (result.length) {
                //User exists
                if (format == "Poll") {
                    Poll.find({_id: {$eq: postId}}).then(data => {
                        if (data.length) {
                            var findUser = data[0]
                            console.log(findUser)
                            console.log("Bruh")
                            console.log(findUser.creatorId)
                            console.log(userId)
                            async function forAwaits(sentIndex) { 
                                console.log(findUser.creatorId)
                                console.log(userId)
                                if (findUser.comments[sentIndex].commentDownVotes.includes(userId)) {
                                    //User has upvoted
                                    Poll.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentDownVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, "Comment DownVote removed")
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentDownVotes`, 'from poll with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing downvote from poll post. Please try again later.')
                                    });
                                } else if (findUser.comments[sentIndex].commentUpVotes.includes(userId)) {
                                    Poll.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentUpVotes`] : userId }, $push: { [`comments.${sentIndex}.commentDownVotes`] : userId }}).then(function(){
                                        HTTPHandler.OK(res, 'Comment DownVoted')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentUpVotes`, 'and pushing:', userId, 'to:', `comments.${sentIndex}.commentDownVotes`, 'on poll with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing upvote and adding downvote to poll post. Please try again later.')
                                    });
                                } else {
                                    Poll.findOneAndUpdate({_id: {$eq: postId}}, { $push: { [`comments.${sentIndex}.commentDownVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, 'Comment DownVoted')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pushing:', userId, ' to:', `comments.${sentIndex}.commentDownVotes`, 'on poll with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while adding downvote to poll post. Please try again later.')
                                    });
                                }
                            }
                            var itemsProcessed = 0
                            findUser.comments.forEach(function (item, index) {
                                console.log(findUser.comments[index].commentId)
                                console.log(commentId)
                                if (findUser.comments[index].commentId == commentId) {
                                    if (itemsProcessed !== null) {
                                        console.log("Found at index:")
                                        console.log(index)
                                        forAwaits(index)
                                        itemsProcessed = null
                                    }
                                } else {
                                    if (itemsProcessed !== null) {
                                        itemsProcessed++;
                                        if(itemsProcessed == findUser.comments.length) {
                                            HTTPHandler.notFound(res, "Couldn't find comment")
                                        }
                                    }
                                }
                            });
                        } else {
                            HTTPHandler.notFound(res, 'Could not find poll post.')
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding poll post with id:', postId, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding poll post. Please try again later.')
                    })
                } else if (format == "Image") {
                    ImagePost.find({_id: {$eq: postId}}).then(data => {
                        if (data.length) {
                            var findUser = data[0]
                            console.log(findUser)
                            console.log("Bruh")
                            console.log(findUser.creatorId)
                            console.log(userId)
                            async function forAwaits(sentIndex) { 
                                console.log(findUser.creatorId)
                                console.log(userId)
                                if (findUser.comments[sentIndex].commentDownVotes.includes(userId)) {
                                    //User has upvoted
                                    ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentDownVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, 'Comment DownVote removed')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentDownVotes`, 'from image post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing downvote from image post. Please try again later.')
                                    });
                                } else if (findUser.comments[sentIndex].commentUpVotes.includes(userId)) {
                                    ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentUpVotes`] : userId }, $push: { [`comments.${sentIndex}.commentDownVotes`] : userId }}).then(function(){
                                        HTTPHandler.OK(res, 'Comment DownVoted')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentUpVotes`, 'and pushing:', userId, 'to:', `comments.${sentIndex}.commentDownVotes`, 'on image post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing upvote and adding downvote to post. Please try again later.')
                                    });
                                } else {
                                    ImagePost.findOneAndUpdate({_id: {$eq: postId}}, { $push: { [`comments.${sentIndex}.commentDownVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, 'Comment DownVoted')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pushing:', userId, 'to:', `comments.${sentIndex}.commentDownVotes`, 'from image post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while downvoting post. Please try again later.')
                                    });
                                }
                            }
                            var itemsProcessed = 0
                            findUser.comments.forEach(function (item, index) {
                                console.log(findUser.comments[index].commentId)
                                console.log(commentId)
                                if (findUser.comments[index].commentId == commentId) {
                                    if (itemsProcessed !== null) {
                                        console.log("Found at index:")
                                        console.log(index)
                                        forAwaits(index)
                                        itemsProcessed = null
                                    }
                                } else {
                                    if (itemsProcessed !== null) {
                                        itemsProcessed++;
                                        if(itemsProcessed == findUser.comments.length) {
                                            HTTPHandler.notFound(res, "Couldn't find comment")
                                        }
                                    }
                                }
                            });
                        } else {
                            HTTPHandler.notFound(res, 'Could not find image post')
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding image post with id:', postId, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding image post. Please try again later.')
                    })
                } else if (format == "Thread") {
                    Thread.find({_id: {$eq: postId}}).then(data => {
                        if (data.length) {
                            var findUser = data[0]
                            console.log(findUser)
                            console.log("Bruh")
                            console.log(findUser.creatorId)
                            console.log(userId)
                            async function forAwaits(sentIndex) { 
                                console.log(findUser.creatorId)
                                console.log(userId)
                                if (findUser.comments[sentIndex].commentDownVotes.includes(userId)) {
                                    //User has downvoted
                                    Thread.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentDownVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, 'Comment DownVote removed')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentDownVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing downvote from thread post. Please try again later.')
                                    });
                                } else if (findUser.comments[sentIndex].commentUpVotes.includes(userId)) {
                                    Thread.findOneAndUpdate({_id: {$eq: postId}}, { $pull: { [`comments.${sentIndex}.commentUpVotes`] : userId }, $push: { [`comments.${sentIndex}.commentDownVotes`] : userId}}).then(function(){
                                        HTTPHandler.OK(res, 'Comment DownVoted')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pulling:', userId, 'from:', `comments.${sentIndex}.commentUpVotes`, 'and pushing:', userId, 'to:', `comments.${sentIndex}.commentDownVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while remvoing upvote and adding downvote to thread post. Please try again later.')
                                    });
                                } else {
                                    Thread.findOneAndUpdate({_id: {$eq: postId}}, { $push: { [`comments.${sentIndex}.commentDownVotes`] : userId }}).then(function(){
                                        console.log("SUCCESS1")
                                        HTTPHandler.OK(res, 'Comment DownVoted')
                                    })
                                    .catch(err => {
                                        console.error('An error occurred while pushing:', userId, 'to:', `comments.${sentIndex}.commentDownVotes`, 'on thread post with id:', postId, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while downvoting thread post. Please try again later.')
                                    });
                                }
                            }
                            var itemsProcessed = 0
                            findUser.comments.forEach(function (item, index) {
                                console.log(findUser.comments[index].commentId)
                                console.log(commentId)
                                if (findUser.comments[index].commentId == commentId) {
                                    if (itemsProcessed !== null) {
                                        console.log("Found at index:")
                                        console.log(index)
                                        forAwaits(index)
                                        itemsProcessed = null
                                    }
                                } else {
                                    if (itemsProcessed !== null) {
                                        itemsProcessed++;
                                        if(itemsProcessed == findUser.comments.length) {
                                            HTTPHandler.notFound(res, "Couldn't find comment")
                                        }
                                    }
                                }
                            });
                        } else {
                            HTTPHandler.notFound(res, 'Thread could not be found')
                        }
                    }).catch(error => {
                        console.error('An error occurred while finding thread with id:', postId, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while finding thread post. Please try again later.')
                    })
                }
            } else {
                HTTPHandler.notFound(res, 'Could not find user with userId provided.')
            }
        }).catch(error => {
            console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
        })
    }
    downVoteComment()
})

router.post('/toggleFollowOfAUser', rateLimiters['/toggleFollowOfAUser'], (req, res) => { // need to add auth and come up with a way to prevent bots
    let {userToFollowPubId} = req.body;
    const userId = req.tokenData;

    if (typeof userToFollowPubId !== 'string') {
        return HTTPHandler.badInput(res, `userToFollowPubId must be a string. Provided type: ${typeof userToFollowPubId}`)
    }

    if (userToFollowPubId.length == 0) {
        return HTTPHandler.badInput(res, 'userToFollowPubId cannot be a blank string.')
    }

    //Check for userId validity and get user for their pub Id
    User.find({_id: {$eq: userId}}).then(userFollowingFound => {
        if (userFollowingFound.length) {
            //Check for other user for validity and to make sure they exist
            User.find({secondId: {$eq: userToFollowPubId}}).then(userGettingFollowed => {
                if (userGettingFollowed[0].blockedAccounts.includes(userFollowingFound[0].secondId)) {
                    HTTPHandler.notFound(res, 'User not found.')
                } else {
                    if (userGettingFollowed.length) {
                        if (userId === userGettingFollowed[0]._id.toString()) {
                            return HTTPHandler.badInput(res, 'You cannot follow yourself')
                        }
                        if (userGettingFollowed[0].privateAccount == true) {
                            if (userGettingFollowed[0].followers.includes(userFollowingFound[0].secondId)) {
                                //UnFollow private account
                                const dbUpdates = [
                                    {
                                        updateOne: {
                                            filter: {_id: {$eq: userGettingFollowed[0]._id}},
                                            update: {$pull : {followers: userFollowingFound[0].secondId}}
                                        }
                                    },
                                    {
                                        updateOne: {
                                            filter: {_id: {$eq: userId}},
                                            update: { $pull : {following: userGettingFollowed[0].secondId}}
                                        }
                                    }
                                ]

                                User.bulkWrite(dbUpdates).then(() => {
                                    HTTPHandler.OK(res, 'UnFollowed User')
                                }).catch(error => {
                                    console.error('An error occurred while unfollowing private account using bulkWrite on the User collection. The updates array was:', dbUpdates, '. The error was:', error)
                                    HTTPHandler.serverError(res, 'An error occurred while unfollowing user. Please try again later.')
                                })
                            } else {
                                if (!userGettingFollowed[0].accountFollowRequests.includes(userFollowingFound[0].secondId)) {
                                    //Request to follow the account
                                    User.findOneAndUpdate({_id: userGettingFollowed[0]._id}, {$push: {accountFollowRequests: userFollowingFound[0].secondId}}).then(function() {
                                        if (userFollowingFound[0].settings.notificationSettings.SendFollowRequests && userGettingFollowed[0].settings.notificationSettings.FollowRequests) {
                                            //If the user following has SENDING follow requests notifications ON and user getting followed has follow requests notifications ON
                                            var notifMessage = {
                                                title: "New Follow Request",
                                                body: userFollowingFound[0].name + " has requested to follow you."
                                            }
                                            var notifData = {
                                                type: "Follow request",
                                                pubIdOfFollower: userFollowingFound[0].secondId
                                            }
                                            sendNotifications(userGettingFollowed[0]._id, notifMessage, notifData)
                                        }
                                        HTTPHandler.OK(res, 'Requested To Follow User')
                                    }).catch(err => {
                                        console.error('An error occurred while pushing:', userFollowingFound[0].secondId, 'to accountFollowRequests on user with id:', userGettingFollowed[0]._id, '. The error was:', error)
                                        HTTPHandler.serverError(res, 'An error occurred while sending follow request to user. Please try again later.')
                                    })
                                } else {
                                    //Remove request to follow the account
                                    User.findOneAndUpdate({_id: userGettingFollowed[0]._id}, {$pull: {accountFollowRequests: userFollowingFound[0].secondId}}).then(function() {
                                        HTTPHandler.OK(res, 'Removed Request To Follow User')
                                    }).catch(err => {
                                        console.error('An error occurred while pulling:', userFollowingFound[0].secondId, 'from accountFollowRequests for user with id:', userGettingFollowed[0]._id, '. The error was:', err)
                                        HTTPHandler.serverError(res, 'An error occurred while removing request to follow user. Please try again later.')
                                    })
                                }
                            }
                        } else {
                            if (!userGettingFollowed[0].followers.includes(userFollowingFound[0].secondId)) {
                                //Follow

                                const dbUpdates = [
                                    {
                                        updateOne: {
                                            filter: {_id: {$eq: userGettingFollowed[0]._id}},
                                            update: {$push : {followers: userFollowingFound[0].secondId}}
                                        }
                                    },
                                    {
                                        updateOne: {
                                            filter: {_id: {$eq: userId}},
                                            update: { $push : {following: userGettingFollowed[0].secondId}}
                                        }
                                    }
                                ]

                                User.bulkWrite(dbUpdates).then(() => {
                                    var notifMessage = {
                                        title: "New Follower",
                                        body: userFollowingFound[0].name + " has followed you."
                                    }
                                    var notifData = {
                                        type: "Follow",
                                        pubIdOfFollower: userFollowingFound[0].secondId
                                    }
                                    sendNotifications(userGettingFollowed[0]._id, notifMessage, notifData)

                                    HTTPHandler.OK(res, 'Followed User')
                                }).catch(error => {
                                    console.error('An error occurred while following not-private account using bulkWrite on the User collection. The updates array was:', dbUpdates, '. The error was:', error)
                                    HTTPHandler.serverError(res, 'An error occurred while following user. Please try again later.')
                                })
                            } else {
                                //UnFollow

                                const dbUpdates = [
                                    {
                                        updateOne: {
                                            filter: {_id: {$eq: userGettingFollowed[0]._id}},
                                            update: {$pull : {followers: userFollowingFound[0].secondId}}
                                        }
                                    },
                                    {
                                        updateOne: {
                                            filter: {_id: {$eq: userId}},
                                            update: { $pull : {following: userGettingFollowed[0].secondId}}
                                        }
                                    }
                                ]

                                User.bulkWrite(dbUpdates).then(() => {
                                    HTTPHandler.OK(res, 'UnFollowed User')
                                }).catch(error => {
                                    console.error('An error occurred while unfollowing not-private account using bulkWrite on the User collection. The updates array was:', dbUpdates, '. The error was:', error)
                                    HTTPHandler.serverError(res, 'An error occurred while unfollowing user. Please try again later.')
                                })
                            }
                        }
                    } else {
                        HTTPHandler.badInput(res, "Couldn't find user to follow. This is likely due to a bad passed public id of the user you are trying to follow")
                    }
                }
            }).catch(err => {
                console.error('An error occurred while finding user with secondId:', userToFollowPubId, '. The error was:', err)
                HTTPHandler.serverError(res, 'An error occurred while finding user to follow. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, "Couldn't find user. This is likely due to a bad passed userId from your account")
        }
    }).catch(err => {
        console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})


router.get('/reloadUsersDetails/:usersPubId', rateLimiters['/reloadUsersDetails/:usersPubId'], (req, res) => {
    let usersPubId = req.params.usersPubId
    let userId = req.tokenData;

    User.findOne({_id: {$eq: userId}}).lean().then(userSearching => {
        if (userSearching) {
            const userSearchingPubId = userSearching.secondId;

            User.find({secondId: {$eq: usersPubId}}).then(userData => {
                if (userData.length) {
                    //could do a user search ig but no need really
                    if (userData[0].blockedAccounts.includes(userSearchingPubId)) {
                        HTTPHandler.notFound(res, 'User not found.')
                    } else {
                        const userDataToSend = {
                            name: userData[0].name,
                            displayName: userData[0].name,
                            followers: userData[0].followers.length,
                            following: userData[0].following.length,
                            totalLikes: userData[0].totalLikes,
                            profileKey: userData[0].profileImageKey,
                            badges: userData[0].badges
                        };

                        if (userData[0].privateAccount == true) {
                            if (userData[0].accountFollowRequests.includes(userSearchingPubId)) {
                                //User has requested to follow this account

                                const toSend = {
                                    ...userDataToSend,
                                    userIsFollowing: 'Requested'
                                }

                                HTTPHandler.OK(res, 'Found', toSend)
                            } else {
                                //User has not requested to follow this private account
                                if (userData[0].followers.includes(userSearchingPubId)) {
                                    // User is following this account

                                    const toSend = {
                                        ...userDataToSend,
                                        userIsFollowing: true
                                    }

                                    HTTPHandler.OK(res, "Found", toSend)
                                } else {
                                    //User is not following this private account

                                    const toSend = {
                                        ...userDataToSend,
                                        userIsFollowing: false
                                    }

                                    HTTPHandler.OK(res, 'Found', toSend)
                                }
                            }
                        } else {
                            if (userData[0].followers.includes(userSearchingPubId)) {

                                const toSend = {
                                    ...userDataToSend,
                                    userIsFollowing: true
                                }

                                HTTPHandler.OK(res, 'Found', toSend)
                            } else {

                                const toSend = {
                                    ...userDataToSend,
                                    userIsFollowing: false
                                }

                                HTTPHandler.OK(res, 'Found', toSend)
                            }    
                        }      
                    }
                } else {
                    HTTPHandler.notFound(res, "Couldn't find user")
                }
            }).catch(err => {
                console.error('An error occurred while finding user with secondId:', usersPubId, '. The error was:', err)
                HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, "Couldn't find user with provided userId")
        }
    }).catch(error => {
        console.error('An error occurred while finding user with id:', userId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/earnSpecialBadge', rateLimiters['/earnSpecialBadge'], (req, res) => {
    const userId = req.tokenData;
    let {badgeEarnt} = req.body;
    
    //Check if an actual special badge was passed
    if (badgeEarnt == "homeScreenLogoPressEasterEgg") { // Will add more badges here when we make more
        User.find({_id: {$eq: userId}}).then(userFound => {
            if (userFound.length) {
                //User found
                if (userFound[0].badges.findIndex(x => x.badgeName == badgeEarnt) !== -1) {
                    //Badge already earnt
                    HTTPHandler.badInput(res, 'Badge already earnt.')
                } else {
                    //Badge not earnt
                    const badge = {
                        badgeName: badgeEarnt,
                        dateRecieved: Date.now()
                    }

                    User.findOneAndUpdate({_id: {$eq: userId}}, { $push : {badges: badge}}).then(function() {
                        HTTPHandler.OK(res, 'Badge earnt.')
                    }).catch(err => {
                        console.error('An error occurred while pushing badge object:', badge, 'to badges array for user with id:', userId, '. The error was:', err)
                        HTTPHandler.serverError(res, 'An error occurred while adding badge to your account. Please try again later.')
                    })
                }
            } else {
                HTTPHandler.notFound(res, "Could not find user with provided userId.")
            }
        }).catch(err => {
            console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
            HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
        })
    } else {
        HTTPHandler.badInput(res, 'Wrong badge was given.')
    }
})

router.post('/getuserbyid', rateLimiters['/getuserbyid'], (req, res) => {
    const {pubId} = req.body;
    const userRequestingId = req.tokenData;

    if (typeof pubId !== 'string') {
        return HTTPHandler.badInput(res, `pubId must be a string. Provided type: ${typeof pubId}`)
    }

    pubId = pubId.toString().trim();

    User.findOne({_id: {$eq: userRequestingId}}).then(requestingUser => {
        if (requestingUser) {
            User.findOne({secondId: {$eq: pubId}}).then(userFound => {
                if (userFound) {
                    const dataToSend = userHandler.returnPublicInformation(userFound, requestingUser)
                    HTTPHandler.OK(res, 'User found.', dataToSend)
                } else {
                    HTTPHandler.notFound(res, 'User not found.')
                }
            }).catch(error => {
                console.error('An error occurred while finding user with secondId:', pubId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'Could not find user with the provided userId')
        }
    }).catch(error => {
        console.error('An error occurred while finding user with id:', userRequestingId, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/makeaccountprivate', rateLimiters['/makeaccountprivate'], (req, res) => {
    const userID = req.tokenData;
    User.find({_id: {$eq: userID}}).then((userFound) => {
        if (userFound.length) {
            // User exists
            User.findOneAndUpdate({_id: {$eq: userID}}, {privateAccount: true}).then(function() {
                HTTPHandler.OK(res, 'Account is now private.')
            }).catch((error) => {
                console.error('An error occurred while making user private (setting privateAccount to true) for user with id:', userID, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while making your account private. Please try again.')
            })
        } else {
            // User does not exist
            HTTPHandler.notFound(res, 'Account with provided userId could not be found.')
        }
    }).catch((error) => {
        console.error('An error occurred while finding user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/makeaccountpublic', rateLimiters['/makeaccountpublic'], (req, res) => {
    const userID = req.tokenData;

    const makeAccountPublic = () => {
        User.findOneAndUpdate({_id: {$eq: userID}}, {privateAccount: false}).then(function() {
            HTTPHandler.OK(res, 'Account is now public.')
        }).catch((error) => {
            console.error('An error occurred while setting privateAccount to false for user with id:', userID, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while making the account public. Please try again later.')
            console.log('An error occured while making account with ID: ' + userID + ' public.')
        })
    };

    User.find({_id: {$eq: userID}}).then(userFound => {
        if (userFound.length) {
            //User found
            const userData = userFound[0];
            const accountsRequestingToFollow = userData.accountFollowRequests
            if (accountsRequestingToFollow.length) {
                const dbUpdates = [
                    {
                        updateOne: {
                            filter: {_id: {$eq: userID}},
                            update: {$push: {followers: {$each: accountsRequestingToFollow}}}
                        }
                    },
                    {
                        updateOne: {
                            filter: {_id: {$eq: userID}},
                            update: {accountFollowRequests: []}
                        }
                    },
                    ...accountsRequestingToFollow.map(accountPubId => {
                        return {
                            updateOne: {
                                filter: {secondId: {$eq: accountPubId}},
                                update: {$push: {following: userFound[0].secondId}}
                            }
                        }
                    })
                ]

                User.bulkWrite(dbUpdates).then(() => {
                    makeAccountPublic()
                }).catch(error => {
                    console.error('An error occurred while making bulkWrite database updates to the User collection. The updates were:', dbUpdates, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while adding users that requested to follow you to your followers list. Please try again later.')
                })
            } else {
                makeAccountPublic()
            }
        } else {
            //User not found
            HTTPHandler.notFound(res, 'User not found.')
        }
    }).catch((error) => {
        console.error('An error occurred while finding user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.get('/getfollowrequests', rateLimiters['/getfollowrequests'], (req, res) => {
    const userID = req.tokenData;

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (userFound) {
            HTTPHandler.OK(res, 'Found user', userFound.accountFollowRequests)
        } else {
            HTTPHandler.notFound(res, 'Cannot find user')
        }
    }).catch(error => {
        console.error('An error occurred while finding user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/denyfollowrequest', rateLimiters['/denyfollowrequest'], (req, res) => {
    const accountFollowRequestedID = req.tokenData;
    let {accountFollowRequestDeniedPubID} = req.body;

    if (typeof accountFollowRequestDeniedPubID !== 'string') {
        return HTTPHandler.badInput(res, `accountFollowRequestDeniedPubID must be a string. Provided type: ${typeof accountFollowRequestDeniedPubID}`)
    }

    if (accountFollowRequestDeniedPubID.length == 0) {
        return HTTPHandler.badInput(res, 'accountFollowRequestDeniedPubID cannot be a blank string.')
    }

    User.find({_id: {$eq: accountFollowRequestedID}}).then(userFound => {
        if (userFound.length) {
            if (userFound[0].accountFollowRequests.includes(accountFollowRequestDeniedPubID)) {
                User.findOne({secondId: {$eq: accountFollowRequestDeniedPubID}}).lean().then(user => {
                    if (user) {
                        User.findOneAndUpdate({_id: {$eq: accountFollowRequestedID}}, {$pull: {accountFollowRequests: accountFollowRequestDeniedPubID}}).then(function() {
                            HTTPHandler.OK(res, 'Request denied.')
                        }).catch(err => {
                            console.error('An error occurred while pulling:', accountFollowRequestDeniedPubID, 'from:', 'accountFollowRequests', 'for user with id:', accountFollowRequestedID, '. The error was:', err)
                            HTTPHandler.serverError(res, 'An error occurred while denying the follow request. Please try again later.')
                        })
                    } else {
                        HTTPHandler.notFound(res, 'User that requested to follow you could not be found')
                    }
                }).catch(error => {
                    console.error('An error occurred while finding user with secondId:', accountFollowRequestDeniedPubID, '. The error was:', error)
                    HTTPHandler.serverError(res, 'An error occurred while finding user that requested to follow you. Please try again later.')
                })
            } else {
                HTTPHandler.notFound(res, 'Follow request could not be found.')
            }
        } else {
            HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }
    }).catch(err => {
        console.error('An error occurred while finding user with id:', accountFollowRequestedID, '. The error was:', err)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/acceptfollowrequest', rateLimiters['/acceptfollowrequest'], (req, res) => {
    const accountFollowRequestedID = req.tokenData;
    let {accountFollowRequestAcceptedPubID} = req.body;


    if (typeof accountFollowRequestAcceptedPubID !== 'string') {
        return HTTPHandler.badInput(res, `accountFollowRequestAcceptedPubID must be a string. Provided type: ${typeof accountFollowRequestAcceptedPubID}`)
    }

    if (accountFollowRequestAcceptedPubID.length == 0) {
        return HTTPHandler.badInput(res, 'accountFollowRequestAcceptedPubID cannot be a blank string.')
    }

    User.findOne({_id: {$eq: accountFollowRequestedID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with provided userId.')
        }

        if (!userFound.accountFollowRequests.includes(accountFollowRequestAcceptedPubID)) {
            //The follow request was not found in the user's list of follow requests
            return HTTPHandler.notFound(res, 'Follow reqeust was not found.')
        }

        User.findOne({secondId: {$eq: accountFollowRequestAcceptedPubID}}).lean().then(userRequesting => {
            if (!userRequesting) {
                return HTTPHandler.notFound(res, 'Could not find user that follow requested')
            }

            const dbUpdates = [
                {
                    updateOne: {
                        filter: {_id: {$eq: accountFollowRequestedID}},
                        update: {$push: {followers: accountFollowRequestAcceptedPubID}, $pull: {accountFollowRequests: accountFollowRequestAcceptedPubID}}
                    }
                },
                {
                    updateOne: {
                        filter: {_id: {$eq: accountFollowRequestAcceptedPubID}},
                        update: {$push: {following: userFound.secondId}}
                    }
                }
            ]

            User.bulkWrite(dbUpdates).then(() => {
                HTTPHandler.OK(res, 'Follow request accepted.')
            }).catch(error => {
                console.error('An error occurred while making the following bulkWrite database updates on the User collection:', dbUpdates, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while accepting the follow request. Please try again later.')
            })
        }).catch(error => {
            console.error('An error occurred while finding user with secondId:', accountFollowRequestAcceptedPubID, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding user that requested to follow you. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding user with id:', accountFollowRequestedID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/removefollowerfromaccount', rateLimiters['/removefollowerfromaccount'], (req, res) => {
    const userID = req.tokenData;
    let {userToRemovePubId} = req.body;

    if (typeof userToRemovePubId !== 'string') {
        return HTTPHandler.badInput(res, `userToRemovePubId must be a string. Provided type: ${typeof userToRemovePubId}`)
    }

    if (userToRemovePubId.length == 0) {
        return HTTPHandler.badInput(res, 'userToRemovePubId cannot be a blank string.')
    }

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }

        User.findOne({secondId: {$eq: userToRemovePubId}}).lean().then(userToRemoveFound => {
            if (!userToRemoveFound) {
                return HTTPHandler.notFound(res, 'User to remove could not be found')
            }

            const dbUpdates = [
                {
                    updateOne: {
                        filter: {_id: {$eq: userID}},
                        update: {$pull: {followers: userToRemoveFound.secondId}}
                    }
                },
                {
                    updateOne: {
                        filter: {secondId: {$eq: userToRemovePubId}},
                        update: {$pull: {following: userFound.secondId}}
                    }
                }
            ]

            User.bulkWrite(dbUpdates).then(() => {
                HTTPHandler.OK(res, 'Follower has been removed.')
            }).catch(error => {
                console.error('An error occurred while making a bulkWrite operatin to the database on the User collection. The dbUpdates to be made were:', dbUpdates, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while removing follower. Please try again later.')
            })
        }).catch(error => {
            console.error('An error occurred while finding one user with secondId:', userToRemovePubId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding user to remove. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/blockaccount', rateLimiters['/blockaccount'], (req, res) => {
    let {userToBlockPubId} = req.body;
    const userID = req.tokenData;

    if (typeof userToBlockPubId !== 'string') {
        return HTTPHandler.badInput(res, `userToBlockPubId must be a string. Provided type: ${typeof userToBlockPubId}`)
    }

    if (userToBlockPubId.length == 0) {
        return HTTPHandler.badInput(res, 'userToBlockPubId cannot be an empty string.')
    }

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'User with provided userId could not be found')
        }

        User.findOne({secondId: {$eq: userToBlockPubId}}).lean().then(userToBlockFound => {
            if (!userToBlockFound) {
                return HTTPHandler.notFound(res, 'User to block could not be found')
            }

            const dbUpdates = [
                {
                    updateOne: {
                        filter: {_id: {$eq: userID}},
                        update: {$pull: {followers: userToBlockFound.secondId}, $push: {blockedAccounts: userToBlockFound.secondId}}
                    }
                },
                {
                    updateOne: {
                        filter: {secondId: {$eq: userToBlockPubId}},
                        update: {$pull: {following: userFound.secondId}}
                    }
                }
            ]

            User.bulkWrite(dbUpdates).then(() => {
                HTTPHandler.OK(res, 'Blocked user.')
            }).catch(error => {
                console.error('An error occurred while making a bulkWrite operation on the User collection. The database updates were:', dbUpdates, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while blocking user. Please try again later.')
            })
        }).catch(error => {
            console.error('An error occurred while finding one user with secondId:', userToBlockPubId, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while finding user to block. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.get('/getuserblockedaccounts', rateLimiters['/getuserblockedaccounts'], (req, res) => {
    const userID = req.tokenData;

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (userFound) {
            HTTPHandler.OK(res, 'Found blocked accounts', userFound.blockedAccounts)
        } else {
            HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/unblockaccount', rateLimiters['/unblockaccount'], (req, res) => {
    const userID = req.tokenData;
    let {userToUnblockPubId} = req.body;

    if (typeof userToUnblockPubId !== 'string') {
        return HTTPHandler.badInput(res, `userToUnblockPubId must be a string. Provided type: ${typeof userToUnblockPubId}`)
    }

    if (userToUnblockPubId.length == 0) {
        return HTTPHandler.badInput(res, 'userToUnblockPubId must not be an empty string.')
    }

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (userFound) {
            User.findOne({secondId: {$eq: userToUnblockPubId}}).lean().then(userToUnblockFound => {
                if (userToUnblockFound) {
                    User.findOneAndUpdate({_id: {$eq: userID}}, {$pull: {blockedAccounts: userToUnblockPubId}}).then(() => {
                        HTTPHandler.OK(res, 'User has been unblocked.')
                    }).catch(error => {
                        console.error('An error occurred while pulling:', userToUnblockPubId, 'from:', 'blockedAccounts', 'for user with id:', userID, '. The error was:', error)
                        HTTPHandler.serverError(res, 'An error occurred while unblocking user. Please try again later.')
                    })
                } else {
                    HTTPHandler.notFound(res, 'Could not find user to unblock.')
                }
            }).catch(error => {
                console.error('An error occurred while finding one user with secondId:', userToUnblockPubId, '. The error was:', error)
                HTTPHandler.serverError(res, 'An error occurred while finding user to unblock. Please try again later.')
            })
        } else {
            HTTPHandler.notFound(res, 'Could not find user with userId provided.')
        }
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/enableAlgorithm',rateLimiters['/enableAlgorithm'], (req, res) => {
    const userID = req.tokenData;

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with userId provided.')
        }

        let newSettings = {...userFound.settings};
        newSettings.algorithmSettings.enabled = true;
        User.findOneAndUpdate({_id: {$eq: userID}}, {settings: newSettings}).then(() => {
            HTTPHandler.OK(res, 'Algorithm has now been enabled.')
        }).catch(error => {
            console.error('An error occurred while updating settings for user with id:', userID, '. The old settings were:', userFound.settings, ' The new settings are:', newSettings, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while turning algorithm on. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.get('/getAuthenticationFactorsEnabled', rateLimiters['/getAuthenticationFactorsEnabled'], (req, res) => {
    const userID = req.tokenData;

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }

        HTTPHandler.OK(res, 'Authentication factors found.', {authenticationFactorsEnabled: userFound.authenticationFactorsEnabled, MFAEmail: userFound.MFAEmail ? blurEmailFunction(userFound.MFAEmail) : null})
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.post('/disableAlgorithm', rateLimiters['/disableAlgorithm'], (req, res) => {
    const userID = req.tokenData;

    User.findOne({_id: {$eq: userID}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }

        let newSettings = {...userFound.settings}
        newSettings.algorithmSettings.enabled = false;
        User.findOneAndUpdate({_id: {$eq: userID}}, {settings: newSettings}).then(() => {
            HTTPHandler.OK(res, 'Algorithm has now been disabled.')
        }).catch(error => {
            console.error('An error occurred while updating algorithm settings for user with id:', userID, ' Old settings:', userFound.settings, 'New settings:', newSettings, '. The error was:', error)
            HTTPHandler.serverError(res, 'An error occurred while disabling algorithm. Please try again later.')
        })
    }).catch(error => {
        console.error('An error occurred while finding one user with id:', userID, '. The error was:', error)
        HTTPHandler.serverError(res, 'An error occurred while finding user. Please try again later.')
    })
})

router.get('/reloadProfileEssentials', rateLimiters['/reloadProfileEssentials'], (req, res) => {
    const userId = req.tokenData;

    User.findOne({_id: {$eq: userId}}).lean().then(userFound => {
        if (!userFound) {
            return HTTPHandler.notFound(res, 'Could not find user with provided userId')
        }

        const sendBackForReload = userHandler.filterUserInformationToSend(userFound)
        HTTPHandler.OK(res, 'Reload Information Successful.', sendBackForReload)
    }).catch(err => {
        console.error('An error occurred while finding user with id:', userId, '. The error was:', err)
        HTTPHandler.serverError(res, 'An error occurred while finding user.')
    })
})

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