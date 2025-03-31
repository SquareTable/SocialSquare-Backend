const jwt = require('jsonwebtoken');

const TEST_CONSTANTS = {
    NOT_STRINGS: [true, false, undefined, null, {}, [], 1, -1],
    INVALID_EMAILS: ["notanemail", "notanemail@gmail.notanemail"],
    INVALID_NAMES: ["abc12!", "abc._.abc", "abc!@#$%^&*()", "(", ")", "$%^&*wegyf"],
    VALID_EMAILS: ["john.sullivan@gmail.com", "john.sullivan@hotmail.com", "john.sullivan123@gmail.com", "mytestemail@gmail.com", "mytestemail@hotmail.com", "myyahooemail@yahoo.com"],
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