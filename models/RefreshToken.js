const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RefreshTokenSchema = new Schema({
    encryptedRefreshToken: String,
    location: String,
    deviceType: String,
    IP: String,
    createdAt: Date,
    userId: mongoose.Schema.Types.ObjectId,
    admin: Boolean,
    notificationKey: String
});

const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);

module.exports = RefreshToken;