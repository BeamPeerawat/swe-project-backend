const mongoose = require('mongoose');

// Check if the model has already been defined
let Subject;

try {
  // Try to get the existing model if it exists
  Subject = mongoose.model('Subject');
} catch (e) {
  // If the model doesn't exist, define it
  const subjectSchema = new mongoose.Schema({
    subjectCode: {
      type: String,
      required: [true, 'รหัสวิชาเป็นสิ่งจำเป็น'],
      unique: true,
      trim: true,
    },
    subjectNameEN: {
      type: String,
      required: [true, 'ชื่อวิชาภาษาอังกฤษเป็นสิ่งจำเป็น'],
      trim: true,
    },
    subjectNameTH: {
      type: String,
      required: [true, 'ชื่อวิชาภาษาไทยเป็นสิ่งจำเป็น'],
      trim: true,
    },
    credits: {
      type: Number,
      required: [true, 'หน่วยกิตเป็นสิ่งจำเป็น'],
      min: [0, 'หน่วยกิตต้องไม่เป็นลบ'],
    },
    description: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }, { collection: 'subjects' });

  Subject = mongoose.model('Subject', subjectSchema);
}

module.exports = Subject;