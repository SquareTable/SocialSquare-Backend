const { Worker } = require('worker_threads');
const HTTPLibrary = require('../libraries/HTTP')
const HTTPHandler = new HTTPLibrary();
const router = require('express').Router();
const path = require('path')

const { tokenValidation } = require("../middleware/TokenHandler");

router.all("/{*splat}", [tokenValidation]); // the /{*splat} just makes it that it affects them all it could be /whatever and it would affect that only

const workerPath = path.resolve('workers', 'FeedWorker.js')

router.post('/viewedPostInFeed', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'viewedPostInFeed',
            functionArgs: [req.tokenData, req.body.postId, req.body.postFormat]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST feed/viewedPostInFeed controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from FeedWorker for POST /viewedPostInFeed:', error)
            HTTPHandler.serverError(res, 'A server error occurred. Please try again.')
        } else {
            console.error('POST feed/viewedPostInFeed controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
})

router.post('/followerFeed', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'followerFeed',
            functionArgs: [req.tokenData, req.body.alreadyOnCurrentFeed]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST feed/followerFeed controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from FeedWorker for POST /followerFeed:', error)
            HTTPHandler.serverError(res, 'A server error occurred. Please try again.')
        } else {
            console.error('POST feed/followerFeed controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
})

router.post('/forYouFeed', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'forYouFeed',
            functionArgs: [req.tokenData, req.body.alreadyOnCurrentFeed]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST feed/forYouFeed controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from FeedWorker for POST /forYouFeed:', error)
            HTTPHandler.serverError(res, 'A server error occurred. Please try again.')
        } else {
            console.error('POST feed/forYouFeed controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
})

module.exports = router;