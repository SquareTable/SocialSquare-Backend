const axios = require('axios');

class Random {
    async generateRandomBase16String() {
        const request = await axios.get(CONSTANTS.RANDOM_EIGHT_CHARACTER_STRING_URL);
        const randomString = String(request.data).trim();
        return randomString.slice(0, 8)
    }
}

module.exports = Random;