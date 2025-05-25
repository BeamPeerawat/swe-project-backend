const express = require('express');
const router = express.Router();
const Subject = require('../models/subject');

// Middleware เพื่อตรวจสอบว่าเป็น admin
const ensureAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
};

// GET all subjects
router.get('/', async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET subject by ID
router.get('/:id', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'ไม่พบรายวิชา' });
    res.json(subject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create new subject
router.post('/', ensureAdmin, async (req, res) => {
  const subject = new Subject({
    subjectCode: req.body.subjectCode,
    subjectNameEN: req.body.subjectNameEN,
    subjectNameTH: req.body.subjectNameTH,
    credits: req.body.credits,
    description: req.body.description,
  });

  try {
    const newSubject = await subject.save();
    res.status(201).json(newSubject);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update subject
router.put('/:id', ensureAdmin, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'ไม่พบรายวิชา' });

    if (req.body.subjectCode) subject.subjectCode = req.body.subjectCode;
    if (req.body.subjectNameEN) subject.subjectNameEN = req.body.subjectNameEN;
    if (req.body.subjectNameTH) subject.subjectNameTH = req.body.subjectNameTH;
    if (req.body.credits) subject.credits = req.body.credits;
    if (req.body.description) subject.description = req.body.description;

    const updatedSubject = await subject.save();
    res.json(updatedSubject);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE subject
router.delete('/:id', ensureAdmin, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'ไม่พบรายวิชา' });

    await subject.deleteOne();
    res.json({ message: 'ลบรายวิชาเรียบร้อยแล้ว' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CHECK if subjectCode exists
router.get('/check/:subjectCode', ensureAdmin, async (req, res) => {
  try {
    const subject = await Subject.findOne({ subjectCode: req.params.subjectCode });
    if (subject) {
      return res.json({ exists: true });
    }
    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;