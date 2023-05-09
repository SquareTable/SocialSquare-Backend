const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
    conversationId: String,
    isEncrypted: Boolean,
    senderId: String,
    chatText: String,
    datePosted: Number,
    dateUpdated: Number,
    cryptographicNonce: Array,
    encryptedChatText: Array,
    isServerMessage: Boolean,
    involvedIds: Object,
    messageReactions: Array,
    inReplyTo: String,
    attatchments: Array
});

const Message = mongoose.model('Message', MessageSchema);

module.exports = Message;