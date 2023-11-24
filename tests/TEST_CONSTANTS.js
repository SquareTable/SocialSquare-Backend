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
    },
    RANDOM_OBJECTIDS: ["6560b01ec5ea35f173c645d4", "6560b0310a9b4c4ee26ce297", "6560b036dbc1f1384347ff61", "6560b047f1045829ebdb6e3b", "6560b0633f3b8652f95e4224"]
}

module.exports = TEST_CONSTANTS;