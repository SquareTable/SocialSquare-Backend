const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ThreadSchema = new Schema({
    creatorId: mongoose.Schema.Types.ObjectId,
    title: String,
    subtitle: String,
    tags: String,
    categoryId: mongoose.Schema.Types.ObjectId,
    body: String,
    imageKey: String,
    imageDescription: String,
    NSFW: Boolean,
    NSFL: Boolean,
    datePosted: Number,
    viewedBy: Array
});

const Thread = mongoose.model('Thread', ThreadSchema);

module.exports = Thread;