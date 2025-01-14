const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PollSchema = new Schema({
    pollTitle: String, 
    pollSubTitle: String,
    options: [{
        title: String,
        color: String
    }],
    creatorId: mongoose.Schema.Types.ObjectId,
    comments: Array,
    datePosted: Number,
    allowScreenShots: Boolean,
    viewedBy: Array
});

const Poll = mongoose.model('Poll', PollSchema);

module.exports = Poll;