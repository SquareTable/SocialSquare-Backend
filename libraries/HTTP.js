const DeviceDetector = require('node-device-detector');
const detector = new DeviceDetector({
    clientIndexes: true,
    deviceIndexes: true,
    maxUserAgentSize: 500
})

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

    getDeviceTypeMiddleware(req, res, next) {
        const useragent = req.headers["user-agent"]
        if (!useragent) {
            req.device = 'Unknown Device'
            return next()
        }

        const detectedDevice = detector.detect(useragent)
        const {brand, model, type} = detectedDevice.device;

        const device = type || 'Device'

        if (!brand && !model) {
            req.device = `Unknown ${device}`
            return next()
        }

        if (brand && !model) {
            req.device = `Unknown ${device} from ${brand}`
            return next()
        }

        if (!brand && model) {
            req.device = `${model} ${device} from unknown brand`
            return next()
        }

        req.device = `${brand} ${model} ${device}`
        next()
    }
}

module.exports = HTTP;