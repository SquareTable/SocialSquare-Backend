const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CategorySchema = new Schema({
    imageKey: String,
    title: String, 
    description: String,
    tags: String,
    NSFW: {type: Boolean, default: false},
    NSFL: {type: Boolean, default: false},
    categoryOwnerId: mongoose.Schema.Types.ObjectId,
    categoryOriginalCreator: mongoose.Schema.Types.ObjectId,
    datePosted: Number,
    userVisits: Array,
    roles: Array // Object array with roles
});

const Category = mongoose.model('Category', CategorySchema);

module.exports = Category;