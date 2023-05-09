const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PopularPostsSchema = new Schema({
    lastUpdated: Number,
    popularPosts: Array
});

const PopularPosts = mongoose.model('PopularPosts', PopularPostsSchema);

module.exports = PopularPosts;