const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PollSchema = new Schema({
    title: String, 
    subtitle: String,
    options: [{
        title: String
    }],
    creatorId: mongoose.Schema.Types.ObjectId,
    datePosted: Number,
    viewedBy: Array
});

const Poll = mongoose.model('Poll', PollSchema);

module.exports = Poll;