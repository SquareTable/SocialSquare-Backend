const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PollSchema = new Schema({
    pollTitle: String, 
    pollSubTitle: String,
    optionOne: String,
    optionOnesColor: String,
    optionOnesVotes: Array,
    optionTwo: String,
    optionTwosColor: String,
    optionTwosVotes: Array,
    optionThree: String,
    optionThreesColor: String,
    optionThreesVotes: Array,
    optionFour: String,
    optionFoursColor: String,
    optionFoursVotes: Array,
    optionFive: String,
    optionFivesColor: String,
    optionFivesVotes: Array,
    optionSix: String,
    optionSixesColor: String,
    optionSixesVotes: Array,
    totalNumberOfOptions: String,
    creatorId: mongoose.Schema.Types.ObjectId,
    comments: Array,
    datePosted: Number,
    allowScreenShots: Boolean,
    viewedBy: Array
});

const Poll = mongoose.model('Poll', PollSchema);

module.exports = Poll;