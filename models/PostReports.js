const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostReportsSchema = new Schema({
    postId: mongoose.Schema.Types.ObjectId,
    reporterId: mongoose.Schema.Types.ObjectId,
    format: String,
    reason: String,
    assignedTo: mongoose.Schema.Types.ObjectId
});

const PostReports = mongoose.model('PostReports', PostReportsSchema);

module.exports = PostReports;