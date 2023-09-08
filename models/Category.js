const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CategorySchema = new Schema({
    imageKey: String,
    categoryTitle: String, 
    categoryDescription: String,
    categoryTags: String,
    members: Array,
    NSFW: false,
    NSFL: {type: Boolean, default: false},
    categoryOwnerId: mongoose.Schema.Types.ObjectId,
    categoryOriginalCreator: mongoose.Schema.Types.ObjectId,
    categoryModeratorIds: Array,
    datePosted: Number,
    allowScreenShots: Boolean,
    userVisits: Array
});

const Category = mongoose.model('Category', CategorySchema);

module.exports = Category;