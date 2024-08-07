const mongoose = require('mongoose');

const CodeTrackerSchema = new mongoose.Schema({
  currentCode: {
    type: Number,
    required: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const CodeTracker = mongoose.model('CodeTracker', CodeTrackerSchema);

module.exports = CodeTracker;
