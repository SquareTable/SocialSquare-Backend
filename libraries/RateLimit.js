const rl = require('express-rate-limit');

function rateLimit(config) {
    if (process.env.isInCI) {
        // Do not do rate limiting in CI
        return function (req, res, next) {
            next()
        }
    } else {
        return rl(config)
    }
}

module.exports = rateLimit;