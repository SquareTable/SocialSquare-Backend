class UUIDLibrary {
    validateV4(uuid) {
        if (typeof uuid !== 'string') return false
        if (uuid.length !== 36) return false
        return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(uuid)
    }
}

module.exports = UUIDLibrary;