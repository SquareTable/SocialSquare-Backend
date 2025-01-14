const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PollSchema = new Schema({
    pollTitle: String, 
    pollSubTitle: String,
    optionOne: String,
    optionOnesColor: String,
    optionTwo: String,
    optionTwosColor: String,
    optionThree: String,
    optionThreesColor: String,
    optionFour: String,
    optionFoursColor: String,
    optionFive: String,
    optionFivesColor: String,
    optionSix: String,
    optionSixesColor: String,
    totalNumberOfOptions: String,
    creatorId: mongoose.Schema.Types.ObjectId,
    datePosted: Number,
    allowScreenShots: Boolean,
    viewedBy: Array
});

const Poll = mongoose.model('Poll', PollSchema);

module.exports = Poll;