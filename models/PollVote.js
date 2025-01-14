const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PollVoteSchema = new Schema({
    pollId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    vote: Number, // 0-based vote index
    dateVoted: Number
})

const PollVote = mongoose.model('PollVote', PollVoteSchema)

module.exports = PollVote;