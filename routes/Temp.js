const { Worker } = require('worker_threads');
const HTTPLibrary = require('../libraries/HTTP')
const HTTPHandler = new HTTPLibrary();
const router = require('express').Router();
const path = require('path')
const rateLimit = require('express-rate-limit');

const workerPath = path.resolve('workers', 'TempWorker.js')

//Image post
const multer  = require('multer')
const path = require('path');
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
            functionArgs: [req.tokenData, req.body.pubId]
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
            functionArgs: [req.tokenData, req.body.pubId]
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
            functionName: 'getProfilePic/:pubId',
            functionArgs: [req.body.pubId]
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

module.exports = router;