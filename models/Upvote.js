const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UpvoteSchema = new Schema({
    postId: mongoose.Schema.Types.ObjectId,
    postFormat: String,
    interactionDate: Number,
    userPublicId: String
});

const Upvote = mongoose.model('Upvote', UpvoteSchema);

module.exports = Upvote;