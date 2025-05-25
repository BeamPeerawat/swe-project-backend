// SWE Project Backend\models\GeneralRequest.js
const mongoose = require('mongoose');

const generalRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: String,
    required: true,
  },
  month: {
    type: String,
    required: true,
  },
  year: {
    type: String,
    required: true,
  },
  studentId: {
    type: String,
    required: true,
    trim: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  faculty: {
    type: String,
    required: true,
    trim: true,
  },
  fieldOfStudy: {
    type: String,
    required: true,
    trim: true,
  },
  petitionType: {
    type: String,
    enum: ['request_leave', 'request_transcript', 'request_change_course', 'other'],
    required: true,
  },
  details: {
    type: String,
    required: true,
    trim: true,
  },
  contactNumber: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d{10}$/, 'Contact number must be 10 digits'],
  },
  signature: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: [
      'draft',
      'pending_advisor',
      'advisor_approved',
      'advisor_rejected',
      'pending_head',
      'head_approved',
      'head_rejected',
    ],
    default: 'draft',
    required: true,
  },
  advisorComment: {
    type: String,
    trim: true,
  },
  headComment: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('GeneralRequest', generalRequestSchema);