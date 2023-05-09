const { Worker } = require('worker_threads');
const HTTPLibrary = require('../libraries/HTTP')
const HTTPHandler = new HTTPLibrary();
const router = require('express').Router();
const path = require('path')

const { tokenValidation } = require("../middleware/TokenHandler");

const workerPath = path.resolve('workers', 'AdminWorker.js')

//login route bypasses JWT verification
router.post('/login', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'login',
            functionArgs: [req.body.email, req.body.password]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from AdminWorker for POST /login:', error)
        HTTPHandler.serverError(res, error)
    })
});

router.all("*", [tokenValidation]); // the * just makes it that it affects them all it could be /whatever and it would affect that only
//All routes below this line will get JWT verification


router.get('/assignReports', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getAssignedReports',
            functionArgs: [req.tokenData]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from AdminWorker for GET /assignReports:', error)
        HTTPHandler.serverError(res, error)
    })
})

router.delete('/dismissPostReport', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'dismissPostReport',
            functionArgs: [req.tokenData, req.body.reportId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from AdminWorker for DELETE /dismissPostReport:', error)
        HTTPHandler.serverError(res, error)
    })
})

router.delete('/postAndReport', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'deletePostAndReport',
            functionArgs: [req.tokenData, req.body.reportId]
        }
    })

    worker.on('message', (result) => {
        res.status(result.statusCode).json(result.data)
    })

    worker.on('error', (error) => {
        console.error('An error occurred from AdminWorker for DELETE /postAndReport:', error)
        HTTPHandler.serverError(res, error)
    })
})


module.exports = router;