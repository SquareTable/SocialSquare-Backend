//This class is to handle HTTP requests for worker threads.
//This class has different methods for HTTP data, and this data will be sent to the main thread to be sent to the user.
class HTTPWT {
    serverError(error) {
        return {
            statusCode: 500,
            data: {
                status: 'FAILED',
                message: error
            }
        }
    }

    badInput(error) {
        return {
            statusCode: 400,
            data: {
                status: 'FAILED',
                message: error
            }
        }
    }

    OK(message, data, extras = {}) {
        const toReturn = {
            statusCode: 200,
            data: {
                status: 'SUCCESS',
                message: message ?? '',
                ...extras
            }
        }

        if (data) {
            toReturn.data.data = data;
        }

        return toReturn
    }

    conflict(message) {
        return {
            statusCode: 409,
            data: {
                status: "FAILED",
                message
            }
        }
    }

    notFound(message) {
        return {
            statusCode: 404,
            data: {
                status: "FAILED",
                message
            }
        }
    }

    forbidden(message) {
        return {
            statusCode: 403,
            data: {
                status: "FAILED",
                message
            }
        }
    }

    unauthorized(message) {
        return {
            statusCode: 401,
            data: {
                status: "FAILED",
                message
            }
        }
    }

    notImplemented(message) {
        return {
            statusCode: 501,
            data: {
                status: "FAILED",
                message
            }
        }
    }
}

module.exports = HTTPWT;