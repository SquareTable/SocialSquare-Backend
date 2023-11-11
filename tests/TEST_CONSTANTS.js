const jwt = require('jsonwebtoken');

const TEST_CONSTANTS = {
    NOT_STRINGS: [true, false, undefined, null, {}, [], 1, -1],
    INVALID_EMAILS: ["notanemail", "notanemail@gmail.notanemail"],
    JWTVerifier: (secret, token) => {
        return new Promise(resolve => {
            jwt.verify(token, secret, (err, decoded) => {
                if (err) return resolve(false);
                if (decoded) return resolve(true);
                resolve(false);
            })
        })
    }
}

module.exports = TEST_CONSTANTS;