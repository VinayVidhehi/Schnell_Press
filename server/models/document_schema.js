const mongoose = require('mongoose');

const ClientDocumentSchema = new mongoose.Schema({
  clientEmail: {
    type: String,
    required:true,
    trim: true,
    lowercase: true,
  },
  documentId: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  sidesPerPage: {
    type: Number,
    enum: [1, 2],
    required: true,
    default: 1
  },
  color: {
    type: String,
    enum: ['monochrome', 'color'],
    required: true
  },
  numberOfCopies: {
    type: Number,
    required: true,
    default: 1
  },
  status: {
    type: Boolean,
    default: false // Not printed
  },
  uniqueCode: {
    type: String,
    required: true,
    unique: true,
  },
  paperType: {
    type: String,
    required: true
  },
  paperSize: {
    type: String,
    required: true
  },
  softBinding: {
    type: Boolean,
    required: true,
    default: false // Not printed
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  priority: {
    type:Number,
    default: 1,
  }
});

const ClientDocument = mongoose.model('ClientDocument', ClientDocumentSchema);

module.exports = ClientDocument;
