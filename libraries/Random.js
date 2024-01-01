const crypto = require('crypto');

class Random {
    generateRandomHexString(length) {
        const randomString = crypto.randomBytes(Math.ceil(length / 2)).toString('hex');

        //Miss out last character to hit length
        return length % 2 === 1 ? randomString.slice(0, randomString.length - 2) : randomString
    }
}

module.exports = Random;