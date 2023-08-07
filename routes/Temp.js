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
    '/changedisplayname': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 3,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "The display name for this account has changed too many times today. Please try again in 24 hours."},
        skipFailedRequests: true,
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
    '/changeusername': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 3,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "The username for this account has been changed more too many times today. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/changebio': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "The bio for this account has been changed too many times today. Please try again in 24 hours."},
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
    '/pollpostcomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have commented on poll posts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/pollpostcommentreply': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have replied to too many comments on poll posts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchforpollcomments': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many comments on poll posts too many times in the last minute. Please try again in 60 seconds."},
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
    '/searchforpollpostsbyid': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many polls in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/upvotepoll': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 45,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have upvoted too many polls in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/downvotepoll': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 45,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have downvoted too many polls in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getsinglepollcomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many single poll comments in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchforpollcommentreplies': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many poll comment replies in the last minute. Please try again in 60 seconds."},
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
    '/imagepostcomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 10,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have commented on image posts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/imagepostcommentreply': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have replied to too many comments on image posts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getimagepostcomments': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 30,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have searched for too many comments on image posts too many times in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/upvoteimage': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 45,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have upvoted too many images in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/downvoteimage': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 45,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have downvoted too many images in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/getsingleimagecomment': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many single image comments in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/searchforimagecommentreplies': rateLimit({
        windowMs: 1000 * 60, //1 minute
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have requested too many single image comment replies in the last minute. Please try again in 60 seconds."},
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
        message: {status: "FAILED", message: "You have joined / left too many categories in the last minute. Please try again in 60 seconds."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/posttextthread': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have created too many text thread posts in the last 24 hours. Please try again in 24 hours."},
        skipFailedRequests: true,
        keyGenerator: (req, res) => req.tokenData //Use req.tokenData (account _id in MongoDB) to identify clients and rate limit
    }),
    '/postimagethread': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, //1 day
        max: 20,
        standardHeaders: false,
        legacyHeaders: false,
        message: {status: "FAILED", message: "You have created too many image thread posts in the last 24 hours. Please try again in 24 hours."},
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
    '/searchforthreadcomments': rateLimit({
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
    })
}


router.post('/sendnotificationkey', rateLimiters['/sendnotificationkey'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'sendnotificationkey',
            functionArgs: [req.tokenData, req.body.keySent]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /sendnotificationkey:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/changedisplayname', rateLimiters['/changedisplayname'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'changedisplayname',
            functionArgs: [req.tokenData, req.body.desiredDisplayName]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /changedisplayname:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /changeemail:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /changeemail:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/changeusername', rateLimiters['/changeusername'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'changeusername',
            functionArgs: [req.tokenData, req.body.desiredUsername]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /changeusername:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/changebio', rateLimiters['/changebio'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'changebio',
            functionArgs: [req.tokenData, req.body.bio]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /changebio:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /searchpageusersearch:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/createpollpost', rateLimiters['/createpollpost'], (req, res) => {
    let {pollTitle, pollSubTitle, optionOne, optionOnesColor, optionTwo, optionTwosColor, optionThree, optionThreesColor, optionFour, optionFoursColor, optionFive, optionFivesColor, optionSix, optionSixesColor, totalNumberOfOptions, sentAllowScreenShots} = req.body;

    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'createpollpost',
            functionArgs: [
                req.tokenData,
                pollTitle,
                pollSubTitle,
                optionOne,
                optionOnesColor,
                optionTwo,
                optionTwosColor,
                optionThree,
                optionThreesColor,
                optionFour,
                optionFoursColor,
                optionFive,
                optionFivesColor,
                optionSix,
                optionSixesColor,
                totalNumberOfOptions,
                sentAllowScreenShots
            ]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /createpollpost:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/searchforpollposts', rateLimiters['/searchforpollposts'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchforpollposts',
            functionArgs: [req.tokenData, req.body.pubId, req.body.previousPostId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /searchforpollposts:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/pollpostcomment', rateLimiters['/pollpostcomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'pollpostcomment',
            functionArgs: [req.tokenData, req.body.comment, req.body.userName, req.body.pollId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /pollpostcomment:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/pollpostcommentreply', rateLimiters['/pollpostcommentreply'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'pollpostcommentreply',
            functionArgs: [req.tokenData, req.body.comment, req.body.userName, req.body.pollId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /pollpostcommentreply:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/searchforpollcomments', rateLimiters['/searchforpollcomments'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchforpollcomments',
            functionArgs: [req.tokenData, req.body.pollId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /searchforpollcomments:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /voteonpoll:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /searchforpollpostsbyid:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/upvotepoll', rateLimiters['/upvotepoll'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'upvotepoll',
            functionArgs: [req.tokenData, req.body.pollId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /upvotepoll:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/downvotepoll', rateLimiters['/downvotepoll'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'downvotepoll',
            functionArgs: [req.tokenData, req.body.pollId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /downvotepoll:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/getsinglepollcomment', rateLimiters['/getsinglepollcomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getsinglepollcomment',
            functionArgs: [req.tokenData, req.body.postId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getsinglepollcomment:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/searchforpollcommentreplies', rateLimiters['/searchforpollcommentreplies'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchforpollcommentreplies',
            functionArgs: [req.tokenData, req.body.postId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /searchforpollcommentreplies:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /deletepoll:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/postImage', rateLimiters['/postImage'], upload.single('image'), async (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postImage',
            functionArgs: [req.tokenData, req.body.title, req.body.description, req.body.sentAllowScreenShots, req.file]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /postImage:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /postProfileImage:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/getImagesFromProfile', rateLimiters['/getImagesFromProfile'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getImagesFromProfile',
            functionArgs: [req.tokenData, req.body.pubId, req.body.previousPostId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getImagesFromProfile:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for GET /getProfilePic/:pubId:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/imagepostcomment', rateLimiters['/imagepostcomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'imagepostcomment',
            functionArgs: [req.tokenData, req.body.comment, req.body.userName, req.body.imageId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /imagepostcomment:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/imagepostcommentreply', rateLimiters['/imagepostcommentreply'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'imagepostcommentreply',
            functionArgs: [req.tokenData, req.body.comment, req.body.userName, req.body.imageId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /imagepostcommentreply:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/getimagepostcomments', rateLimiters['/getimagepostcomments'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getimagepostcomments',
            functionArgs: [req.tokenData, req.body.postId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getimagepostcomments:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/upvoteimage', rateLimiters['/upvoteimage'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'upvoteimage',
            functionArgs: [req.tokenData, req.body.imageId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /upvoteimage:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/downvoteimage', rateLimiters['/downvoteimage'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'downvoteimage',
            functionArgs: [req.tokenData, req.body.imageId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /downvoteimage:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/getsingleimagecomment', rateLimiters['/getsingleimagecomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getsingleimagecomment',
            functionArgs: [req.tokenData, req.body.postId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getsingleimagecomment:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/searchforimagecommentreplies', rateLimiters['/searchforimagecommentreplies'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchforimagecommentreplies',
            functionArgs: [req.tokenData, req.body.postId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /searchforimagecommentreplies:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/postcategorywithimage', rateLimiters['/postcategorywithimage'], upload.single('image'), async (req, res) => {
    let {categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postcategorywithimage',
            functionArgs: [req.tokenData, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots, req.file]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /postcategorywithimage:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/deleteimage', rateLimiters['/deleteimage'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'deleteimage',
            functionArgs: [req.tokenData, req.body.imageId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /deleteimage:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/postcategorywithoutimage', rateLimiters['/postcategorywithoutimage'], (req, res) => {
    let {categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postcategorywithoutimage',
            functionArgs: [req.tokenData, categoryTitle, categoryDescription, categoryTags, categoryNSFW, categoryNSFL, sentAllowScreenShots]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /postcategorywithoutimage:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/searchpagesearchcategories', rateLimiters['/searchpagesearchcategories'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchpagesearchcategories',
            functionArgs: [req.tokenData, req.body.val]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /searchpagesearchcategories:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getcategoryimage:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /findcategorybyid:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/findcategoryfromprofile', rateLimiters['/findcategoryfromprofile'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'findcategoryfromprofile',
            functionArgs: [req.tokenData, req.body.pubId, req.body.previousCategoryId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /findcategoryfromprofile:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /joincategory:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/posttextthread', rateLimiters['/posttextthread'], (req, res) => {
    let {threadTitle, threadSubtitle, threadTags, threadCategoryId, threadBody, threadNSFW, threadNSFL, sentAllowScreenShots} = req.body;

    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'posttextthread',
            functionArgs: [req.tokenData, threadTitle, threadSubtitle, threadTags, threadCategoryId, threadBody, threadNSFW, threadNSFL, sentAllowScreenShots]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /posttextthread:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/postimagethread', rateLimiters['/postimagethread'], upload.single('image'), async (req, res) => {
    let {threadTitle, threadSubtitle, threadTags, threadCategoryId, threadImageDescription, threadNSFW, threadNSFL, sentAllowScreenShots} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'postimagethread',
            functionArgs: [req.tokenData, threadTitle, threadSubtitle, threadTags, threadCategoryId, threadImageDescription, threadNSFW, threadNSFL, sentAllowScreenShots, req.file]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /postimagethread:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getthreadsfromcategory:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/getthreadsfromprofile', rateLimiters['/getthreadsfromprofile'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getthreadsfromprofile',
            functionArgs: [req.tokenData, req.body.pubId, req.body.previousPostId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getthreadsfromprofile:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/upvotethread', rateLimiters['/upvotethread'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'upvotethread',
            functionArgs: [req.tokenData, req.body.threadId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /upvotethread:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/downvotethread', rateLimiters['/downvotethread'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'downvotethread',
            functionArgs: [req.tokenData, req.body.threadId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /downvotethread:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/threadpostcomment', rateLimiters['/threadpostcomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'threadpostcomment',
            functionArgs: [req.tokenData, req.body.comment, req.body.userName, req.body.threadId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /threadpostcomment:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/threadpostcommentreply', rateLimiters['/threadpostcommentreply'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'threadpostcommentreply',
            functionArgs: [req.tokenData, req.body.comment, req.body.userName, req.body.threadId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /threadpostcommentreply:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/searchforthreadcomments', rateLimiters['/searchforthreadcomments'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchforthreadcomments',
            functionArgs: [req.tokenData, req.body.threadId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /searchforthreadcomments:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/getsinglethreadcomment', rateLimiters['/getsinglethreadcomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getsinglethreadcomment',
            functionArgs: [req.tokenData, req.body.threadId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getsinglethreadcomment:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/searchforthreadcommentreplies', rateLimiters['/searchforthreadcommentreplies'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'searchforthreadcommentreplies',
            functionArgs: [req.tokenData, req.body.threadId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /searchforthreadcommentreplies:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getthreadbyid:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /deletethread:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/upvotecomment', rateLimiters['/upvotecomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'upvotecomment',
            functionArgs: [req.tokenData, req.body.format, req.body.postId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /upvotecomment:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/downvotecomment', rateLimiters['/downvotecomment'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'downvotecomment',
            functionArgs: [req.tokenData, req.body.format, req.body.postId, req.body.commentId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /downvotecomment:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/toggleFollowOfAUser', rateLimiters['/toggleFollowOfAUser'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'toggleFollowOfAUser',
            functionArgs: [req.tokenData, req.body.userToFollowPubId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /toggleFollowOfAUser:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /reloadUsersDetails:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /earnSpecialBadge:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getuserbyid:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /makeaccountprivate:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /makeaccountpublic:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/getfollowrequests', rateLimiters['/getfollowrequests'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getfollowrequests',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getfollowrequests:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /denyfollowrequest:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /acceptfollowrequest:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /removefollowerfromaccount:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /blockaccount:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.get('/getuserblockedaccounts', rateLimiters['/getuserblockedaccounts'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getuserblockedaccounts',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for GET /getuserblockedaccounts:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /unblockaccount:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /enableAlgorithm:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for GET /getAuthenticationFactorsEnabled:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /disableAlgorithm:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /reloadProfileEssentials:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /turnOffEmailMultiFactorAuthentication:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /deleteaccount:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /checkIfCategoryExists:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /uploadNotificationsSettings:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getUserNotificationSettings:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /reportUser:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/getUserActivity', rateLimiters['/getUserActivity'], (req, res) => {
    let {skip = 0, voteType, postFormat} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getUserActivity',
            functionArgs: [req.tokenData, skip, voteType, postFormat]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getUserActivity:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.post('/getCategoriesUserIsAPartOf', rateLimiters['/getCategoriesUserIsAPartOf'], (req, res) => {
    let {skip = 0} = req.body;
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getCategoriesUserIsAPartOf',
            functionArgs: [req.tokenData, skip]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getCategoriesUserIsAPartOf:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /reportPost:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for GET /userAlgorithmSettings:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /uploadAlgorithmSettings:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for GET /privacySettings:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /savePrivacySettings:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /getProfileStats:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for GET /loginactivity:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /logoutdevice:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /logoutallotherdevices:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for GET /loginActivitySettings:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /uploadLoginActivitySettings:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for POST /updateLoginActivitySettingsOnSignup:', error)
        HTTPHandler.serverError(res, error)
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
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from TempWorker for GET /followingFeedFilterSettings:', error)
        HTTPHandler.serverError(res, error)
    })
});

module.exports = router;