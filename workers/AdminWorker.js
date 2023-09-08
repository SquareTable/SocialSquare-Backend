const { workerData, parentPort } = require('worker_threads')
const HTTPWT = require('../libraries/HTTPWT')
const HTTPWTHandler = new HTTPWT()

const controller = require('../controllers/Admin')

const functionName = workerData.functionName;
const functionArgs = workerData.functionArgs || [];

if (controller[functionName] === undefined) {
    console.error('Invalid Admin controller function called from AdminWorker. Function name:', functionName)
    parentPort.postMessage(
        HTTPWTHandler.serverError('Invalid admin function was called')
    )
}

async function run() {
    try {
        const result = await controller[functionName](...functionArgs)
        parentPort.postMessage(result)
    } catch (error) {
        console.error('An error occurred while getting result from Admin controller function called:', functionName, '. Arguments provided were:', functionArgs, '. The error was:', error)
        parentPort.postMessage(
            HTTPWTHandler.serverError(error)
        )
    }
}

require('../config/db').then(async connection => {
    await run();
    console.log('Disconnecting Admin thread from database...')
    try {
        await connection.disconnect()
    } catch (error) {
        console.error('An error occurred while disconnecting from database in AdminWorker for Admin controller function:', functionName, '. The error was:', error)
    }
}).catch((err) => {
    console.error('An error occurred while connecting to database for AdminWorker:', err)
    parentPort.postMessage(
        HTTPWTHandler.serverError('A database error occurred. Please try again.')
    )
})