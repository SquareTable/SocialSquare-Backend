const expressDevice = require('express-device');

class HTTP {
    serverError(res, error) {
        if (typeof res !== 'object' || Array.isArray(res) || res === null) throw new Error('res is not an object. Provided to HTTP.serverError')
        res.status(500).json({
            status: "FAILED",
            message: error
        })
    }

    badInput(res, error) {
        if (typeof res !== 'object' || Array.isArray(res) || res === null) throw new Error('res is not an object. Provided to HTTP.badInput')
        res.status(400).json({
            status: "FAILED",
            message: error
        })
    }

    OK(res, message, data, extras = {}) {
        if (typeof res !== 'object' || Array.isArray(res) || res === null) throw new Error('res is not an object. Provided to HTTP.OK')
        if (typeof extras !== 'object') throw new Error('extras is not an object. Provided to HTTP.OK')
        
        const json = {
            status: "SUCCESS",
            message,
            ...extras
        }

        if (data) {
            json.data = data;
        }

        res.json(json)
    }

    conflict(res, message) {
        if (typeof res !== 'object' || Array.isArray(res) || res === null) throw new Error('res is not an object. Provided to HTTP.conflict')
        res.status(409).json({
            status: "FAILED",
            message
        })
    }

    notFound(res, message) {
        if (typeof res !== 'object' || Array.isArray(res) || res === null) throw new Error('res is not an object. Provided to HTTP.notFound')
        res.status(404).json({
            status: "FAILED",
            message
        })
    }

    forbidden(res, message) {
        if (typeof res !== 'object' || Array.isArray(res) || res === null) throw new Error('res is not an object. Provided to HTTP.forbidden')
        res.status(403).json({
            status: "FAILED",
            message
        })
    }

    unauthorized(res, message) {
        if (typeof res !== 'object' || Array.isArray(res) || res === null) throw new Error('res is not an object. Provided to HTTP.unauthorized')
        res.status(401).json({
            status: "FAILED",
            message
        })
    }

    notImplemented(res, message) {
        if (typeof res !== 'object' || Array.isArray(res) || res === null) throw new Error('res is not an object. Provided to HTTP.unauthorized')
        res.status(501).json({
            status: "FAILED",
            message
        })
    }

    getIP(req) {
        if (typeof req !== 'object') throw new Error('req is not an object. Provided to HTTP.getIP')
        let IP = req.ip;

        return this.formatIP(IP)
    }

    formatIP(IP) {
        return IP.replace("::ffff:", "");
    }

    getDeviceTypeMiddleware() {
        return expressDevice.capture({
            parseUserAgent: true,
            unknownUserAgentDeviceType: 'Unknown Device',
            emptyUserAgentDeviceType: 'Unknown Device'
        })
    }
}

module.exports = HTTP;