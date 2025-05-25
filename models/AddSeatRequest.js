const mongoose = require('mongoose');

const addSeatRequestSchema = new mongoose.Schema({
  semester: { type: String, required: true, trim: true },
  academicYear: { type: String, required: true, trim: true },
  date: { type: String, required: true, trim: true },
  month: { type: String, required: true, trim: true },
  year: { type: String, required: true, trim: true },
  lecturer: { type: String, required: true, trim: true },
  studentName: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, trim: true },
  levelOfStudy: { type: String, required: true }, // เปลี่ยนจาก [String] เป็น String เพราะเป็น radio button
  faculty: { type: String, required: true, trim: true },
  fieldOfStudy: { type: String, required: true, trim: true },
  classLevel: { type: String, required: true, trim: true },
  courseCode: { type: String, required: true, trim: true },
  courseTitle: { type: String, required: true, trim: true },
  section: { type: String, required: true, trim: true },
  credits: { type: String, required: true, trim: true },
  day: { type: String, required: true, trim: true },
  time: { type: String, required: true, trim: true },
  room: { type: String, required: true, trim: true },
  contactNumber: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  signature: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'instructor_approved', 'instructor_rejected'],
    default: 'draft'
  },
  instructorComment: { type: String, trim: true }, // หมายเหตุจากอาจารย์
  userId: {
    type: String,
    required: true,
    trim: true
  }
}, { collection: 'addseatrequests', timestamps: true });

module.exports = mongoose.model('AddSeatRequest', addSeatRequestSchema);