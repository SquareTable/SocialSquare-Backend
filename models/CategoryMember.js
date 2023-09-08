const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CategoryMemberSchema = new Schema({
    userId: mongoose.Schema.Types.ObjectId,
    categoryId: mongoose.Schema.Types.ObjectId,
    dateJoined: Number,
    role: String
})

const CategoryMember = mongoose.model('CategoryMember', CategoryMemberSchema)

module.exports = CategoryMember;