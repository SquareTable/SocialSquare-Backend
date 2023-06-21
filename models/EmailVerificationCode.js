const mongoose = require('mongoose');
const CONSTANTS = require('../constants');
const Schema = mongoose.Schema;

const EmailVerificationCodeSchema = new Schema({
    createdAt: {
        type: Date,
        expires: CONSTANTS.EMAIL_VERIFICATION_CODE_EXPIRE_TIME_SECONDS,
        default: Date.now, //Creates a new UNIX Epoch milliseconds timestamp on document creation
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    hashedVerificationCode: {
        type: String,
        required: true
    }
});

const EmailVerificationCode = mongoose.model('EmailVerificationCode', EmailVerificationCodeSchema);

module.exports = EmailVerificationCode;