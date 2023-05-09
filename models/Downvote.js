const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DownvoteSchema = new Schema({
    postId: mongoose.Schema.Types.ObjectId,
    postFormat: String,
    interactionDate: Number,
    userPublicId: String
});

const Downvote = mongoose.model('Downvote', DownvoteSchema);

module.exports = Downvote;