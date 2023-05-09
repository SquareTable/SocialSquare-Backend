const { Worker } = require('worker_threads');
const HTTPLibrary = require('../libraries/HTTP')
const HTTPHandler = new HTTPLibrary();
const router = require('express').Router();
const path = require('path')

const { tokenValidation } = require("../middleware/TokenHandler");

router.all("*", [tokenValidation]); // the * just makes it that it affects them all it could be /whatever and it would affect that only

const workerPath = path.resolve('workers', 'FeedWorker.js')

router.post('/viewedPostInFeed', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'viewedPostInFeed',
            functionArgs: [req.tokenData, req.body.postId, req.body.postFormat]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from FeedWorker for POST /viewedPostInFeed:', error)
        HTTPHandler.serverError(res, 'A server error occurred. Please try again.')
    })
})

router.post('/followerFeed', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'followerFeed',
            functionArgs: [req.tokenData, req.body.alreadyOnCurrentFeed]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from FeedWorker for POST /followerFeed:', error)
        HTTPHandler.serverError(res, 'A server error occurred. Please try again.')
    })
})

router.post('/forYouFeed', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'forYouFeed',
            functionArgs: [req.tokenData, req.body.alreadyOnCurrentFeed]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from FeedWorker for POST /forYouFeed:', error)
        HTTPHandler.serverError(res, 'A server error occurred. Please try again.')
    })
})

module.exports = router;