const { workerData, parentPort } = require('worker_threads')
const mongoose = require('mongoose')
const HTTPWT = require('../libraries/HTTPWT')
const HTTPWTHandler = new HTTPWT()

const controller = require('../controllers/Feed')

const functionName = workerData.functionName;
const functionArgs = workerData.functionArgs || [];

if (controller[functionName] === undefined) {
    console.error('Invalid Feed controller function called from FeedWorker. Function name:', functionName)
    parentPort.postMessage(
        HTTPWTHandler.serverError('Invalid feed function was called')
    )
}

async function run() {
    try {
        const result = await controller[functionName](...functionArgs)
        parentPort.postMessage(result)
    } catch (error) {
        console.error('An error occurred while getting result from Feed controller function called:', functionName, '. Arguments provided were:', functionArgs, '. The error was:', error)
        parentPort.postMessage(
            HTTPWTHandler.serverError('A server error occurred. Please try again.')
        )
    }
}

require('../config/db').then(async connection => {
    await run();
    console.log('Disconnecting Feed thread from database...')
    try {
        await connection.disconnect();
    } catch (error) {
        console.error('An error occurred while disconnecting from database in FeedWorker for Feed controller function:', functionName, '. The error was:', error)
    }
}).catch((err) => {
    console.error('An error occurred while connecting to database for FeedWorker:', err)
    parentPort.postMessage(
        HTTPWTHandler.serverError('A database error occurred. Please try again.')
    )
})