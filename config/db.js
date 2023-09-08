//require('dotenv').config();
const mongoose = require('mongoose');

module.exports = mongoose.connect(process.env.MONGODB_URI, {
  useUnifiedTopology: true,
})