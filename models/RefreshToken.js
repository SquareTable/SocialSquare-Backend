const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RefreshTokenSchema = new Schema({
    encryptedRefreshToken: String,
    location: String,
    deviceType: String,
    IP: String,
    createdAt: {type: Date, expires: 15 * 60}, //RefreshTokens will get deleted 15 minutes after creation
    userId: mongoose.Schema.Types.ObjectId,
    admin: Boolean,
    notificationKey: String
});

const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);

module.exports = RefreshToken;