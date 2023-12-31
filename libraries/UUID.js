const {validate, version} = require('uuid')

class UUIDLibrary {
    validateV4(uuid) {
        return validate(uuid) && version(uuid) === 4
    }
}

module.exports = UUIDLibrary;