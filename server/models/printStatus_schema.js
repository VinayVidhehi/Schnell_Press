const mongoose = require('mongoose');

const PrintStatsSchema = new mongoose.Schema({
  totalPrints: {
    type: Number,
    default: 0,
    required: true
  },
  totalValue: {
    type: Number,
    default: 0,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const PrintStats = mongoose.model('PrintStats', PrintStatsSchema);

module.exports = PrintStats;
