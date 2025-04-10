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
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('POST admin/login controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from AdminWorker for POST /login:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('POST admin/login controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
});

router.all("/{*splat}", [tokenValidation]); // the /{*splat} just makes it that it affects them all it could be /whatever and it would affect that only
//All routes below this line will get JWT verification


router.get('/assignReports', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'getAssignedReports',
            functionArgs: [req.tokenData]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('GET admin/assignReports controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from AdminWorker for GET /assignReports:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('GET admin/assignReports controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
})

router.delete('/dismissPostReport', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'dismissPostReport',
            functionArgs: [req.tokenData, req.body.reportId]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('DELETE admin/dismissPostReport controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from AdminWorker for DELETE /dismissPostReport:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('DELETE admin/dismissPostReport controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
})

router.delete('/postAndReport', (req, res) => {
    const worker = new Worker(workerPath, {
        workerData: {
            functionName: 'deletePostAndReport',
            functionArgs: [req.tokenData, req.body.reportId]
        },
        env: process.env
    })

    worker.on('message', (result) => {
        if (!res.headersSent) {
            res.status(result.statusCode).json(result.data)
        } else {
            console.error('DELETE admin/postAndReport controller function returned data to be sent to the client but HTTP headers have already been sent! Data to be returned:', result)
        }
    })

    worker.on('error', (error) => {
        if (!res.headersSent) {
            console.error('An error occurred from AdminWorker for DELETE /postAndReport:', error)
            HTTPHandler.serverError(res, String(error))
        } else {
            console.error('DELETE admin/postAndReport controller function encountered an error and tried to return it to the client but HTTP headers have already been sent! Error to be returned:', error)
        }
    })
})


module.exports = router;