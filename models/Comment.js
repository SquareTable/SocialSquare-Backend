const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CommentSchema = new Schema({
    commenterId: mongoose.Schema.Types.ObjectId,
    text: String,
    datePosted: Number,
    postId: mongoose.Schema.Types.ObjectId,
    postFormat: String
});

const Comment = mongoose.model('Comment', CommentSchema);

module.exports = Comment;