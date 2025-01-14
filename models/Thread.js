const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ThreadSchema = new Schema({
    threadType: String,
    creatorId: mongoose.Schema.Types.ObjectId,
    threadTitle: String,
    threadSubtitle: String,
    threadTags: String,
    threadCategoryId: mongoose.Schema.Types.ObjectId,
    threadBody: String,
    threadImageKey: String,
    threadImageDescription: String,
    threadNSFW: Boolean,
    threadNSFL: Boolean,
    datePosted: Number,
    allowScreenShots: Boolean,
    viewedBy: Array
});

const Thread = mongoose.model('Thread', ThreadSchema);

module.exports = Thread;