const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
	userId: mongoose.Types.ObjectId,
	profilePublicId: String,
	postId: mongoose.Types.ObjectId,
	postFormat: String,
	dateCreated: Date,
	text: String
})

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;