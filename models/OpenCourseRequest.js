const mongoose = require('mongoose');

const openCourseRequestSchema = new mongoose.Schema({
  semester: { type: String, required: true, trim: true },
  academicYear: { type: String, required: true, trim: true },
  date: { type: String, required: true, trim: true },
  month: { type: String, required: true, trim: true },
  year: { type: String, required: true, trim: true },
  dean: { type: String, required: true, trim: true },
  studentName: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, trim: true },
  levelOfStudy: { type: String, required: true },
  faculty: { type: String, required: true, trim: true },
  fieldOfStudy: { type: String, required: true, trim: true },
  courseCode: { type: String, required: true, trim: true },
  courseTitle: { type: String, required: true, trim: true },
  credits: { type: String, required: true, trim: true },
  reason: { type: String, required: true, trim: true },
  contactNumber: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  signature: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['draft', 'pending_advisor', 'advisor_approved', 'advisor_rejected', 'pending_head', 'head_approved', 'head_rejected'],
    default: 'draft'
  },
  advisorComment: { type: String, trim: true },
  headComment: { type: String, trim: true },
  userId: { type: String, required: true, trim: true }
}, { collection: 'opencourserequests', timestamps: true });

module.exports = mongoose.model('OpenCourseRequest', openCourseRequestSchema);