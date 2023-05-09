const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ImageSchema = new Schema({
    imageKey: String,
    imageTitle: String, 
    imageDescription: String,
    upVotes: Array,
    downVotes: Array,
    creatorId: mongoose.Schema.Types.ObjectId,
    comments: Array,
    datePosted: Number,
    allowScreenShots: Boolean,
    viewedBy: Array,
    tags: Array,
    uploadedFrom: {type: String, default: 'SocialSquare'}
});

const ImagePost = mongoose.model('ImagePost', ImageSchema);

module.exports = ImagePost;