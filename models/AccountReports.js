const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AccountReportsSchema = new Schema({
    reportedAccountPubId: String,
    reporterId: mongoose.Schema.Types.ObjectId,
    topic: String,
    subTopic: String,
    assignedTo: mongoose.Schema.Types.ObjectId
});

const AccountReports = mongoose.model('AccountReports', AccountReportsSchema);

module.exports = AccountReports;