const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PollSchema = new Schema({
    pollTitle: String, 
    pollSubTitle: String,
    options: [{
        title: String
    }],
    creatorId: mongoose.Schema.Types.ObjectId,
    datePosted: Number,
    allowScreenShots: Boolean,
    viewedBy: Array
});

const Poll = mongoose.model('Poll', PollSchema);

module.exports = Poll;