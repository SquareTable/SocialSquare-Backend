const { Worker } = require('worker_threads');
const HTTPLibrary = require('../libraries/HTTP')
const HTTPHandler = new HTTPLibrary();
const router = require('express').Router();
const path = require('path')
const rateLimit = require('../libraries/RateLimit');

const workerPath = path.resolve('workers', 'UserWorker.js')

const rateLimiters = {
    '/signup': rateLimit({
        windowMs: 1000 * 60 * 60 * 24, // 1 day
        limit: 3, // Limit each IP to 3 requests per `window` (here 1 day)
        standardHeaders: false, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        message: {status: "FAILED", message: 'The network you are on has made too many accounts in the last 24 hours. Please try again tomorrow.'}, // Message to send to client when they have been rate-limited
        skipFailedRequests: true // Request will not be counted if it fails
    }),
    '/signin': rateLimit({
        windowMs: 1000 * 60, // 1 minute
        limit: 1,
        standardHeaders: false, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        message: {status: "FAILED", message: "This account has been logged into too many times in the past minute. Please wait 60 seconds and try again."},
        skipFailedRequests: true, // Request will not be counted if it fails
        keyGenerator: (req, res) => req.body.email
    }),
    '/checkusernameavailability': rateLimit({
        windowMs: 1000 * 30, // 30 seconds
        limit: 90, //3 per second in 30 second window
        standardHeaders: false,
        legacyHeaders: false,
        skipFailedRequests: true,
        message: {status: "FAILED", message: "Too many usernames have been checked in the last 30 seconds. Please wait 30 seconds and try again."}
    }),
    '/sendemailverificationcode': rateLimit({
        windowMs: 1000 * 60, // 1 minute
        limit: 12, // 1 per 5 seconds in minute window
        standardHeaders: false,
        legacyHeaders: false,
        skipFailedRequests: true,
        message: {status: "FAILED", message: "Too many email verification codes have been sent in the last minute. Please wait 60 seconds and try again."}
    }),
    '/checkverificationcode': rateLimit({
        windowMs: 1000 * 60, //1 minute
        limit: 6, //1 per 10 seconds in minute window
        standardHeaders: false,
        legacyHeaders: false,
        skipFailedRequests: true,
        message: {status: "FAILED", message: "Too many verification codes have been checked in the last minute. Please wait 60 seconds and try again."}
    }),
    '/changepasswordwithverificationcode': rateLimit({
        windowMs: 1000 * 60, //1 minute
        limit: 1, //1 per minute in minute window
        standardHeaders: false,
        legacyHeaders: false,
        skipFailedRequests: true,
        message: {status: "FAILED", message: "Your password has been changed too many times within the last minute. Please wait 60 seconds and try again."}
    })
}

router.post('/signup', rateLimiters['/signup'], HTTPHandler.getDeviceTypeMiddleware, (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'signup',
            functionArgs: [req.body.name, req.body.email, req.body.password, req.ip, req.device]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST user/signup controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from UserWorker for POST /signup:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST user/signup controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
});

router.post('/signin', rateLimiters['/signin'], HTTPHandler.getDeviceTypeMiddleware, (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'signin',
            functionArgs: [req.body.email, req.body.password, req.ip, req.device]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST user/signin controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from UserWorker for POST /signin:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST user/signin controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
});

router.post('/checkusernameavailability', rateLimiters['/checkusernameavailability'], (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'checkusernameavailability',
            functionArgs: [req.body.username]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST user/checkusernameavailability controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from UserWorker for POST /checkusernameavailability:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST user/checkusernameavailability controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
});

router.post('/sendemailverificationcode', rateLimiters['/sendemailverificationcode'], (req, res) => {
    const {userID, task, getAccountMethod, username, email, secondId} = req.body;
    
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'sendemailverificationcode',
            functionArgs: [userID, task, getAccountMethod, username, email, secondId]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST user/sendemailverificationcode controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from UserWorker for POST /sendemailverificationcode:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST user/sendemailverificationcode controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
})

router.post('/checkverificationcode', rateLimiters['/checkverificationcode'], HTTPHandler.getDeviceTypeMiddleware, (req, res) => {
    let {username, verificationCode, task, getAccountMethod, userID, email, secondId} = req.body;
    
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'checkverificationcode',
            functionArgs: [username, verificationCode, task, getAccountMethod, userID, email, secondId, req.ip, req.device]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST user/checkverificationcode controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from UserWorker for POST /checkverificationcode:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST user/checkverificationcode controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
})

router.post('/changepasswordwithverificationcode', rateLimiters['/changepasswordwithverificationcode'], (req, res) => {
    let {newPassword, confirmNewPassword, verificationCode, username} = req.body;
    
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'changepasswordwithverificationcode',
            functionArgs: [newPassword, confirmNewPassword, verificationCode, username]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST user/changepasswordwithverificationcode controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from UserWorker for POST /changepasswordwithverificationcode:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST user/changepasswordwithverificationcode controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
})


module.exports = router;