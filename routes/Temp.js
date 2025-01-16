const { Worker } = require('worker_threads');
const HTTPLibrary = require('../libraries/HTTP')
const HTTPHandler = new HTTPLibrary();
const router = require('express').Router();
const path = require('path')
const rateLimit = require('express-rate-limit');

const workerPath = path.resolve('workers', 'TempWorker.js')

//Image post
const multer  = require('multer')
const CONSTANTS = require('../constants');
const { v4: uuidv4 } = require('uuid');


const storage = multer.diskStorage({
    // Destination to store image     
    destination: (req, file, cb) => {
        cb(null, process.env.TEMP_IMAGES_PATH)
    },
    filename: (req, file, cb) => {
        let extName = path.extname(file.originalname)
        if (extName === ".png" || extName === ".jpg" || extName === ".jpeg") {
            const newUUID = uuidv4(); 
            cb(null, newUUID + extName); 
        } else {
            cb("Invalid file format")
        }      
    }
});

const upload = multer({ storage: storage })

const { tokenValidation } = require("../middleware/TokenHandler");

router.all("*", [tokenValidation]); // the * just makes it that it affects them all it could be /whatever and it would affect that only

const rateLimiters = {
    '/sendnotificationkey': rateLimit({
        windowMs: 1000 * 60, // 1 minute
        max: 2, // Limit each IP to 10 requests per `window` (here 1 minute)
        standardHeaders: false, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        message: {status: "FAILED", message: 'Too many notification keys have been sent in the last minute. Please try again in 60 seconds.'}, // Message to send to client when they have been rate-limited
        skipFailedRequests: true, // Request will not be counted if it fails
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/changeemail': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 2,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: 'The email for this account has changed too many times today. Please try again in 24 hours.'},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/changepassword': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 3,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "The password for this account has been changed too many times today. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchpageusersearch': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for users too many times in the past minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/createpollpost': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have created too many poll posts in the last 24 hours. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchforpollposts': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many poll posts in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/voteonpoll': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have voted on too many poll posts in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/removevoteonpoll': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have removed your vote on too many poll posts in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchforpollpostsbyid': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many polls in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/deletepoll': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have deleted too many polls in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/postImage': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have created too many image posts in the last 24 hours. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/postProfileImage': rateLimit({
        windowMs: 1000 * 60 * 60, //1 hour
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have changed your profile picture too many times in the last hour. Please try again in 60 minutes."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getImagesFromProfile': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many image posts in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getProfilePic/:pubId': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 90,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many profile pictures in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/postcategorywithimage': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 2,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have created too many categories with images today. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/deleteimage': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have deleted too many image posts in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/postcategorywithoutimage': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 2,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have created too many categories without images today. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchpagesearchcategories': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many categories in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getcategoryimage': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many categories' images in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/findcategorybyid': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many categories by id in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/findcategoryfromprofile': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many categories from profiles in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/joincategory': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 6,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have joined too many categories in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/leavecategory': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 6,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have left too many categories in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/postthread': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have created too many thread posts in the last 24 hours. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getthreadsfromcategory': rateLimit({
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
    '/getthreadbyid': rateLimit({
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
    '/reloadUsersDetails': rateLimit({
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
    '/followrequests/:skip': rateLimit({
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
    '/checkIfCategoryExists': rateLimit({
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
        message: {status: "FAILED", message: "You have requested login activity too many times in the last minute. Please try again in 60 seconds."},
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
    }),
    '/logoutuser': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "Too many accounts have been logged out from this account in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/deletecomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have deleted too many comments in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getsinglecomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many single comments in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getcommentreplies': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many comment replies in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/voteoncomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have voted on too many comments in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/replytocomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have replied to comments too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/postcomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have commented too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchforpostcomments': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for comments on posts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/removevoteoncomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have removed votes from comments too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/voteonpost': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have voted on too many posts in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/removevoteonpost': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have removed too many votes from posts in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/followuser': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 6,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have followed too many accounts in the past minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/unfollowuser': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 6,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have unfollowed too many accounts in the past minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getvotedusersofpost': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 12,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have retrieved the users that have voted on a certain post too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getcategorymembers': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have retrieved the members of a category too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getpollvoteusers': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 5,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have retrieved the users that have voted on this poll too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/editprofiledetails': rateLimit({
        windowMs: 1000 * 60 * 60 * 6, //6 hours
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "The details for this account has been changed too many times in the past 6 hours. Please try again in 6 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
}


router.post('/sendnotificationkey', rateLimiters['/sendnotificationkey'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'sendnotificationkey',
            functionArgs: [req.tokenData, req.body.keySent, req.body.refreshTokenId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/sendnotificationkey controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /sendnotificationkey:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/sendnotificationkey controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/changeemail', rateLimiters['/changeemail'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'changedisplayname',
            functionArgs: [req.tokenData, req.body.password, req.body.desiredEmail]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/changeemail controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /changeemail:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/changeemail controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/changepassword', rateLimiters['/changepassword'], HTTPHandler.getDeviceTypeMiddleware(), (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'changepassword',
            functionArgs: [req.tokenData, req.body.currentPassword, req.body.newPassword, req.body.confirmNewPassword, req.ip, req.device.name]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/changepassword controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /changeemail:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/changepassword controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/searchpageusersearch', rateLimiters['/searchpageusersearch'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchpageusersearch',
            functionArgs: [req.tokenData, req.body.skip, req.body.val]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/searchpageusersearch controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /searchpageusersearch:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/searchpageusersearch controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/createpollpost', rateLimiters['/createpollpost'], (req, res) => {
    let {pollTitle, pollSubTitle, options} = req.body;

    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'createpollpost',
            functionArgs: [
                req.tokenData,
                pollTitle,
                pollSubTitle,
                options
            ]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/createpollpost controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /createpollpost:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/createpollpost controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/searchforpollposts', rateLimiters['/searchforpollposts'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchforpollposts',
            functionArgs: [req.tokenData, req.body.pubId, req.body.lastItemId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/searchforpollposts controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /searchforpollposts:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/searchforpollposts controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/voteonpoll', rateLimiters['/voteonpoll'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'voteonpoll',
            functionArgs: [req.tokenData, req.body.optionSelected, req.body.pollId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/voteonpoll controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /voteonpoll:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/voteonpoll controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/removevoteonpoll', rateLimiters['/removevoteonpoll'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'removevoteonpoll',
            functionArgs: [req.tokenData, req.body.pollId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/removevoteonpoll controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /removevoteonpoll:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/removevoteonpoll controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/searchforpollpostsbyid', rateLimiters['/searchforpollpostsbyid'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchforpollpostsbyid',
            functionArgs: [req.tokenData, req.body.pollId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/searchforpollpostsbyid controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /searchforpollpostsbyid:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/searchforpollpostsbyid controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/deletepoll', rateLimiters['/deletepoll'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'deletepoll',
            functionArgs: [req.tokenData, req.body.pollId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/deletepoll controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /deletepoll:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/deletepoll controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/postImage', rateLimiters['/postImage'], upload.single('image'), async (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postImage',
            functionArgs: [req.tokenData, req.body.title, req.body.description, req.file]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/postImage controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /postImage:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/deleteImage controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/postProfileImage', rateLimiters['/postProfileImage'], upload.single('image'), async (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postProfileImage',
            functionArgs: [req.tokenData, req.file]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/postProfileImage controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /postProfileImage:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/postProfileImage controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getImagesFromProfile', rateLimiters['/getImagesFromProfile'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getImagesFromProfile',
            functionArgs: [req.tokenData, req.body.pubId, req.body.lastItemId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POSST temp/getImagesFromProfile controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getImagesFromProfile:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getImagesFromProfile controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.get('/getProfilePic/:pubId', rateLimiters['/getProfilePic/:pubId'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getProfilePic',
            functionArgs: [req.params.pubId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET temp/getProfilePic/:pubId controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for GET /getProfilePic/:pubId:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET temp/getProfilePic/:pubId controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/postcategorywithimage', rateLimiters['/postcategorywithimage'], upload.single('image'), async (req, res) => {
    let {categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postcategorywithimage',
            functionArgs: [req.tokenData, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, req.file]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/postcategorywithimage controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /postcategorywithimage:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/postcategorywithimage controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/deleteimage', rateLimiters['/deleteimage'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'deleteimage',
            functionArgs: [req.tokenData, req.body.postId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/deleteimage controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /deleteimage:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/deleteimage controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/postcategorywithoutimage', rateLimiters['/postcategorywithoutimage'], (req, res) => {
    let {categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postcategorywithoutimage',
            functionArgs: [req.tokenData, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/postcategorywithoutimage controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /postcategorywithoutimage:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/postcategorywithoutimage controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/searchpagesearchcategories', rateLimiters['/searchpagesearchcategories'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchpagesearchcategories',
            functionArgs: [req.tokenData, req.body.val, req.body.lastItemId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/searchpagesearchcategories controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /searchpagesearchcategories:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/searchpagesearchcategories controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getcategoryimage', rateLimiters['/getcategoryimage'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getcategoryimage',
            functionArgs: [req.body.val]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getcategoryimage  controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getcategoryimage:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getcategoryimage controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/findcategorybyid', rateLimiters['/findcategorybyid'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'findcategorybyid',
            functionArgs: [req.tokenData, req.body.categoryId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/fimdcategorybyid controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /findcategorybyid:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/findcategorybyid controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/findcategoryfromprofile', rateLimiters['/findcategoryfromprofile'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'findcategoryfromprofile',
            functionArgs: [req.tokenData, req.body.pubId, req.body.lastItemId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/findcategoryfromprofile controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /findcategoryfromprofile:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/findcategoryfromprofile controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/joincategory', rateLimiters['/joincategory'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'joincategory',
            functionArgs: [req.tokenData, req.body.categoryId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/joincategory controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /joincategory:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/joincategory controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/leavecategory', rateLimiters['/leavecategory'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'leavecategory',
            functionArgs: [req.tokenData, req.body.categoryId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/leavecategory controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /leavecategory:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/leavecategory controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
});

router.post('/postthread', rateLimiters['/postthread'], upload.single('image'), async (req, res) => {
    let {threadTitle, threadSubtitle, threadTags, threadCategoryId, threadImageDescription, threadNSFW, threadNSFL} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postthread',
            functionArgs: [req.tokenData, threadTitle, threadSubtitle, threadTags, threadCategoryId, threadImageDescription, threadNSFW, threadNSFL, req.file]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/postthread controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /postthread:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/postthread controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getthreadsfromcategory', rateLimiters['/getthreadsfromcategory'], (req, res) => {
    let {categoryId} = req.body;

    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getthreadsfromcategory',
            functionArgs: [req.tokenData, categoryId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getthreadsfromcategory controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getthreadsfromcategory:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getthreadsfromcategory controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getthreadsfromprofile', rateLimiters['/getthreadsfromprofile'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getthreadsfromprofile',
            functionArgs: [req.tokenData, req.body.pubId, req.body.lastItemId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getthreadsfromprofile controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getthreadsfromprofile:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getthreadsfromprofile controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getthreadbyid', rateLimiters['/getthreadbyid'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getthreadbyid',
            functionArgs: [req.tokenData, req.body.threadId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getthreadbyid controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getthreadbyid:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getthreadbyid controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/deletethread', rateLimiters['/deletethread'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'deletethread',
            functionArgs: [req.tokenData, req.body.threadId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/deletethread controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /deletethread:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/deletethread controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/reloadUsersDetails', rateLimiters['/reloadUsersDetails'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'reloadUsersDetails',
            functionArgs: [req.tokenData, req.body.usersPubId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/reloadUsersDetails controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /reloadUsersDetails:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/reloadUsersDetails controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/earnSpecialBadge', rateLimiters['/earnSpecialBadge'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'earnSpecialBadge',
            functionArgs: [req.tokenData, req.body.badgeEarnt]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/earnSpecialBadge controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /earnSpecialBadge:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/earnSpecialBadge controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getuserbyid', rateLimiters['/getuserbyid'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getuserbyid',
            functionArgs: [req.tokenData, req.body.pubId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getuserbyid controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getuserbyid:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getuserbyid controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/makeaccountprivate', rateLimiters['/makeaccountprivate'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'makeaccountprivate',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/makeaccountprivate controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /makeaccountprivate:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/makeaccountprivate controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/makeaccountpublic', rateLimiters['/makeaccountpublic'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'makeaccountpublic',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/makeaccountpublic controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /makeaccountpublic:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/makeaccountpublic controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.get('/followrequests/:skip', rateLimiters['/followrequests/:skip'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getfollowrequests',
            functionArgs: [req.tokenData, req.params.skip]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET temp/followrequests/:skip controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /followrequests/:skip:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET temp/followrequests/:skip controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/denyfollowrequest', rateLimiters['/denyfollowrequest'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'denyfollowrequest',
            functionArgs: [req.tokenData, req.body.accountFollowRequestDeniedPubID]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/denyfollowrequest controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /denyfollowrequest:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/denyfollowrequest controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/acceptfollowrequest', rateLimiters['/acceptfollowrequest'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'acceptfollowrequest',
            functionArgs: [req.tokenData, req.body.accountFollowRequestAcceptedPubID]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/acceptfollowrequest controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /acceptfollowrequest:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/acceptfollowrequest controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/removefollowerfromaccount', rateLimiters['/removefollowerfromaccount'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'removefollowerfromaccount',
            functionArgs: [req.tokenData, req.body.userToRemovePubId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/removefollowerfromaccount controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /removefollowerfromaccount:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/removefollowerfromaccount controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/blockaccount', rateLimiters['/blockaccount'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'blockaccount',
            functionArgs: [req.tokenData, req.body.userToBlockPubId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/blockaccount controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /blockaccount:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/blockaccount controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getuserblockedaccounts', rateLimiters['/getuserblockedaccounts'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getuserblockedaccounts',
            functionArgs: [req.tokenData, req.body.skip]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getuserblockedaccounts controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getuserblockedaccounts:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getuserblockedaccounts controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/unblockaccount', rateLimiters['/unblockaccount'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'unblockaccount',
            functionArgs: [req.tokenData, req.body.userToUnblockPubId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/unblockaccount controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /unblockaccount:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/unblockaccount controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/enableAlgorithm', rateLimiters['/enableAlgorithm'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'enableAlgorithm',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/enableAlgorithm controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /enableAlgorithm:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/enableAlgorithm controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.get('/getAuthenticationFactorsEnabled', rateLimiters['/getAuthenticationFactorsEnabled'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getAuthenticationFactorsEnabled',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET temp/getAuthenticationFactorsEnabled controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for GET /getAuthenticationFactorsEnabled:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET temp/getAuthenticationFactorsEnabled controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/disableAlgorithm', rateLimiters['/disableAlgorithm'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'disableAlgorithm',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/disableAlgorithm controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /disableAlgorithm:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/disableAlgorithm controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/reloadProfileEssentials', rateLimiters['/reloadProfileEssentials'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'reloadProfileEssentials',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/reloadProfileEssentials controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /reloadProfileEssentials:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/reloadProfileEssentials controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/turnOffEmailMultiFactorAuthentication', rateLimiters['/turnOffEmailMultiFactorAuthentication'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'turnOffEmailMultiFactorAuthentication',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/turnOffEmailMultiFactorAuthentication controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /turnOffEmailMultiFactorAuthentication:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/turnOffEmailMultiFactorAuthentication controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/deleteaccount', rateLimiters['/deleteaccount'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'deleteaccount',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/deleteaccount controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /deleteaccount:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/deleteaccount controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/checkIfCategoryExists', rateLimiters['/checkIfCategoryExists'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'checkIfCategoryExists',
            functionArgs: [req.body.categoryTitle]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/checkIfCategoryExists controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /checkIfCategoryExists:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/checkIfCategoryExists controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/uploadNotificationsSettings', rateLimiters['/uploadNotificationsSettings'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'uploadNotificationsSettings',
            functionArgs: [req.tokenData, req.body.notificationSettings]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/uploadNotificationsSettings controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /uploadNotificationsSettings:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/uploadNotificationsSettings controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.get('/getUserNotificationSettings', rateLimiters['/getUserNotificationSettings'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getUserNotificationSettings',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET temp/getUserNotificationSettings controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for GET /getUserNotificationSettings:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET temp/getUserNotificationSettings controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/reportUser', rateLimiters['/reportUser'], (req, res) => {
    let {reportType, reporteePubId} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'reportUser',
            functionArgs: [req.tokenData, reportType, reporteePubId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/reportUser controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /reportUser:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/reportUser controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getUserActivity', rateLimiters['/getUserActivity'], (req, res) => {
    let {skip, voteType, postFormat} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getUserActivity',
            functionArgs: [req.tokenData, skip, voteType, postFormat]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getUserActivity controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getUserActivity:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getUserActivity controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/reportPost', rateLimiters['/reportPost'], (req, res) => {
    const {postId, postFormat, reason} = req.body
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'reportPost',
            functionArgs: [req.tokenData, postId, postFormat, reason]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/reportPost controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /reportPost:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/reportPost controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.get('/userAlgorithmSettings', rateLimiters['/userAlgorithmSettings'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'userAlgorithmSettings',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET temp/userAlgorithmSettings controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for GET /userAlgorithmSettings:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET temp/userAlgorithmSettings controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/uploadAlgorithmSettings', rateLimiters['/uploadAlgorithmSettings'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'uploadAlgorithmSettings',
            functionArgs: [req.tokenData, req.body.algorithmSettings]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/uploadAlgorithmSettings controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /uploadAlgorithmSettings:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/uploadAlgorithmSettings controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.get('/privacySettings', rateLimiters['/privacySettings'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'privacySettings',
            functionArgs: [req.tokenData, req.body.algorithmSettings]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET temp/privacySettings controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for GET /privacySettings:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET temp/privacySettings controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/savePrivacySettings', rateLimiters['/savePrivacySettings'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'savePrivacySettings',
            functionArgs: [req.tokenData, req.body.settings]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/savePrivacySettings controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /savePrivacySettings:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/savePrivacySettings controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getProfileStats', rateLimiters['/getProfileStats'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getProfileStats',
            functionArgs: [req.tokenData, req.body.pubId, req.body.skip, req.body.stat]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getProfileStats controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getProfileStats:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getProfileStats controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.get('/loginactivity', rateLimiters['/loginactivity'], (req, res) => {
    const authRefreshTokenHeader = req.headers["auth-refresh-token"]
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'loginactivity',
            functionArgs: [req.tokenData, authRefreshTokenHeader]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET temp/loginactivity controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for GET /loginactivity:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET temp/loginactivity controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/logoutdevice', rateLimiters['/logoutdevice'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'logoutdevice',
            functionArgs: [req.tokenData, req.body.tokenToLogout]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/logoutdevice controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /logoutdevice:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/logoutdevice controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/logoutallotherdevices', rateLimiters['/logoutallotherdevices'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'logoutallotherdevices',
            functionArgs: [req.tokenData, req.body.tokenIdNotToLogout]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/logoutallotherdevices controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /logoutallotherdevices:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/logoutallotherdevices controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.get('/loginActivitySettings', rateLimiters['/loginActivitySettings'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'loginActivitySettings',
            functionArgs: [req.tokenData, req.body.tokenIdNotToLogout]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET temp/loginActivitySettings controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for GET /loginActivitySettings:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET temp/loginActivitySettings controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/uploadLoginActivitySettings', rateLimiters['/uploadLoginActivitySettings'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'uploadLoginActivitySettings',
            functionArgs: [req.tokenData, req.body.newSettings]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/uploadLoginActivitySettings controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /uploadLoginActivitySettings:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/uploadLoginActivitySettings controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/updateLoginActivitySettingsOnSignup', rateLimiters['/updateLoginActivitySettingsOnSignup'], HTTPHandler.getDeviceTypeMiddleware(), (req, res) => {
    const {newSettings, refreshTokenId} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'updateLoginActivitySettingsOnSignup',
            functionArgs: [req.tokenData, newSettings, refreshTokenId, req.ip, req.device.name]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/updateLoginActivitySettingsOnSignup controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /updateLoginActivitySettingsOnSignup:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/updateLoginActivitySettingsOnSignup controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.get('/followingFeedFilterSettings', rateLimiters['/followingFeedFilterSettings'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'followingFeedFilterSettings',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET temp/followingFeedFilterSettings controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for GET /followingFeedFilterSettings:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET temp/followingFeedFilterSettings controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/logoutuser', rateLimiters['/logoutuser'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'logoutuser',
            functionArgs: [req.tokenData, req.body.refreshTokenId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/logoutuser controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /logoutuser:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/logoutuser controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/deletecomment', rateLimiters['/deletecomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'deletecomment',
            functionArgs: [req.tokenData, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/deletecomment controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /deletecomment:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/deletecomment controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getsinglecomment', rateLimiters['/getsinglecomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getsinglecomment',
            functionArgs: [req.tokenData, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getsinglecomment controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getsinglecomment:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getsinglecomment controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getcommentreplies', rateLimiters['/getcommentreplies'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getcommentreplies',
            functionArgs: [req.tokenData, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getcommentreplies controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getcommentreplies:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getcommentreplies controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/voteoncomment', rateLimiters['/voteoncomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'voteoncomment',
            functionArgs: [req.tokenData, req.body.commentId, req.body.voteType]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/voteoncomment controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /voteoncomment:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/voteoncomment controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/replytocomment', rateLimiters['/replytocomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'replytocomment',
            functionArgs: [req.tokenData, req.body.comment, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/replytocomment controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /replytocomment:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/replytocomment controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/postcomment', rateLimiters['/postcomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postcomment',
            functionArgs: [req.tokenData, req.body.comment, req.body.postId, req.body.postFormat]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/postcomment controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /postcomment:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/postcomment controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/searchforpostcomments', rateLimiters['/searchforpostcomments'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchforpostcomments',
            functionArgs: [req.tokenData, req.body.postId, req.body.postFormat]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/searchforpostcomments controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /searchforpostcomments:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/searchforpostcomments controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/removevoteoncomment', rateLimiters['/removevoteoncomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'removevoteoncomment',
            functionArgs: [req.tokenData, req.body.commentId, req.body.voteType]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/removevoteoncomment controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /removevoteoncomment:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/removevoteoncomment controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/voteonpost', rateLimiters['/voteonpost'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'voteonpost',
            functionArgs: [req.tokenData, req.body.postId, req.body.postFormat, req.body.voteType]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/voteonpost controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /voteonpost:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/voteonpost controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/removevoteonpost', rateLimiters['/removevoteonpost'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'removevoteonpost',
            functionArgs: [req.tokenData, req.body.postId, req.body.postFormat, req.body.voteType]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/removevoteonpost controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /removevoteonpost:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/removevoteonpost controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/followuser', rateLimiters['/followuser'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'followuser',
            functionArgs: [req.tokenData, req.body.userPubId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/followuser controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /followuser:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/followuser controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/unfollowuser', rateLimiters['/unfollowuser'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'unfollowuser',
            functionArgs: [req.tokenData, req.body.userPubId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/unfollowuser controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /unfollowuser:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/unfollowuser controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getvotedusersofpost', rateLimiters['/getvotedusersofpost'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getvotedusersofpost',
            functionArgs: [req.tokenData, req.body.postId, req.body.postFormat, req.body.lastItemId, req.body.voteType]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getvotedusersofpost controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getvotedusersofpost:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getvotedusersofpost controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getcategorymembers', rateLimiters['/getcategorymembers'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getcategorymembers',
            functionArgs: [req.tokenData, req.body.categoryId, req.body.lastItemId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getcategorymembers controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getcategorymembers:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getcategorymembers controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/getpollvoteusers', rateLimiters['/getpollvoteusers'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getpollvoteusers',
            functionArgs: [req.tokenData, req.body.pollId, req.body.pollOption, req.body.lastItemId]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/getpollvoteusers controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /getpollvoteusers:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/getpollvoteusers controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

router.post('/editprofiledetails', rateLimiters['/editprofiledetails'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'editprofiledetails',
            functionArgs: [req.tokenData, req.body]
        }
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST temp/editprofiledetails controller function returned data to be sent to the client but HTTP headers have already been sent! Data attempted to send:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from TempWorker for POST /editprofiledetails:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST temp/editprofiledetails controller function encountered an error and tried to send it to the client but HTTP headers have already been sent! Error attempted to send:', error)
        }
    })
});

module.exports = router;