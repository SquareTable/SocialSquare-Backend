const { workerData, parentPort } = require('worker_threads')
const HTTPWT = require('../libraries/HTTPWT')
const HTTPWTHandler = new HTTPWT()

const controller = require('../controllers/User')

const functionName = workerData.functionName;
const functionArgs = workerData.functionArgs || [];

if (controller[functionName] === undefined) {
    console.error('Invalid Feed controller function called from UserWorker. Function name:', functionName)
    parentPort.postMessage(
        HTTPWTHandler.serverError('Invalid user function was called')
    )
}

async function run() {
    try {
        const result = await controller[functionName](...functionArgs)
        parentPort.postMessage(result)
    } catch (error) {
        console.error('An error occurred while getting result from User controller function called:', functionName, '. Arguments provided were:', functionArgs, '. The error was:', error)
        parentPort.postMessage(
            HTTPWTHandler.serverError('A server error occurred. Please try again.')
        )
    }
}

require('../config/db').then(async connection => {
    await run();
    console.log('Disconnecting from database on User Thread...')
    try {
        await connection.disconnect()
    } catch (error) {
        console.error('An error occurred while disconnecting from database in UserWorker for User controller function:', functionName, '. The error was:', error)
    }
}).catch((err) => {
    console.error('An error occurred while connecting to database for UserWorker:', err)
    parentPort.postMessage(
        HTTPWTHandler.serverError('A database error occurred. Please try again.')
    )
})