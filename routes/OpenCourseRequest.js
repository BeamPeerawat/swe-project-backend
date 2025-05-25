const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const OpenCourseRequest = require('../models/OpenCourseRequest');
const User = require('../models/User');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs').promises;
const path = require('path');

// GET all draft forms for a user
router.get('/drafts', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const drafts = await OpenCourseRequest.find({
      userId,
      status: 'draft',
    }).select('courseCode courseTitle semester academicYear createdAt');
    const count = drafts.length;
    res.json({ drafts, count });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET all request forms
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const forms = await OpenCourseRequest.find({ userId }).select('-__v');
    res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET open course requests by email or userId
router.get('/opencourserequests', async (req, res) => {
  try {
    const { email, userId } = req.query;
    const query = {};
    if (email) query.email = email;
    if (userId) query.userId = userId;

    if (!email && !userId) {
      return res.status(400).json({ message: 'ต้องระบุ email หรือ userId' });
    }

    const requests = await OpenCourseRequest.find(query);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching open course requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET pending requests for advisor
router.get('/advisor/pending', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'advisor') {
      return res.status(403).json({ message: 'เฉพาะอาจารย์ที่ปรึกษาเท่านั้นที่สามารถดูคำร้องนี้ได้' });
    }
    const requests = await OpenCourseRequest.find({ status: 'pending_advisor' });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching advisor pending requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET pending requests for head
router.get('/head/pending', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'head') {
      return res.status(403).json({ message: 'เฉพาะหัวหน้าสาขาเท่านั้นที่สามารถดูคำร้องนี้ได้' });
    }
    const requests = await OpenCourseRequest.find({ status: 'advisor_approved' });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching head pending requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET request form by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const form = await OpenCourseRequest.findById(req.params.id).select('-__v');
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงคำร้องนี้' });
    }
    res.json(form);
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST submit form
router.post('/submit', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'student') {
      return res.status(403).json({ message: 'เฉพาะนักศึกษาเท่านั้นที่สามารถยื่นคำร้องได้' });
    }
    const form = new OpenCourseRequest({
      ...req.body,
      userId,
      status: 'pending_advisor',
    });
    const savedForm = await form.save();
    res.status(201).json(savedForm);
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST save draft
router.post('/draft', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'student') {
      return res.status(403).json({ message: 'เฉพาะนักศึกษาเท่านั้นที่สามารถบันทึกร่างได้' });
    }
    const form = new OpenCourseRequest({
      ...req.body,
      userId,
      status: 'draft',
    });
    const savedForm = await form.save();
    const draftCount = await OpenCourseRequest.countDocuments({
      userId,
      status: 'draft',
    });
    res.status(201).json({ form: savedForm, draftCount });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST approve request by advisor
router.post('/:id/approve', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'advisor') {
      return res.status(403).json({ message: 'เฉพาะอาจารย์ที่ปรึกษาเท่านั้นที่สามารถอนุมัติได้' });
    }
    const form = await OpenCourseRequest.findById(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.status !== 'pending_advisor') {
      return res.status(400).json({ message: 'คำร้องนี้ไม่อยู่ในสถานะรอพิจารณาโดยอาจารย์ที่ปรึกษา' });
    }
    form.status = 'advisor_approved';
    form.advisorComment = req.body.comment || '';
    const updatedForm = await form.save();
    res.json(updatedForm);
  } catch (error) {
    console.error('Error approving form:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST reject request by advisor
router.post('/:id/reject', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'advisor') {
      return res.status(403).json({ message: 'เฉพาะอาจารย์ที่ปรึกษาเท่านั้นที่สามารถปฏิเสธได้' });
    }
    const form = await OpenCourseRequest.findById(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.status !== 'pending_advisor') {
      return res.status(400).json({ message: 'คำร้องนี้ไม่อยู่ในสถานะรอพิจารณาโดยอาจารย์ที่ปรึกษา' });
    }
    form.status = 'advisor_rejected';
    form.advisorComment = req.body.comment || '';
    const updatedForm = await form.save();
    res.json(updatedForm);
  } catch (error) {
    console.error('Error rejecting form:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST approve request by head
router.post('/:id/head/approve', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'head') {
      return res.status(403).json({ message: 'เฉพาะหัวหน้าสาขาเท่านั้นที่สามารถอนุมัติได้' });
    }
    const form = await OpenCourseRequest.findById(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.status !== 'advisor_approved') {
      return res.status(400).json({ message: 'คำร้องนี้ไม่อยู่ในสถานะรอพิจารณาโดยหัวหน้าสาขา' });
    }
    form.status = 'head_approved';
    form.headComment = req.body.comment || '';
    const updatedForm = await form.save();
    res.json(updatedForm);
  } catch (error) {
    console.error('Error approving head form:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST reject request by head
router.post('/:id/head/reject', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'head') {
      return res.status(403).json({ message: 'เฉพาะหัวหน้าสาขาเท่านั้นที่สามารถปฏิเสธได้' });
    }
    const form = await OpenCourseRequest.findById(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.status !== 'advisor_approved') {
      return res.status(400).json({ message: 'คำร้องนี้ไม่อยู่ในสถานะรอพิจารณาโดยหัวหน้าสาขา' });
    }
    form.status = 'head_rejected';
    form.headComment = req.body.comment || '';
    const updatedForm = await form.save();
    res.json(updatedForm);
  } catch (error) {
    console.error('Error rejecting head form:', error);
    res.status(400).json({ message: error.message });
  }
});

// PUT update form
router.put('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const form = await OpenCourseRequest.findById(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์อัปเดตคำร้องนี้' });
    }
    Object.keys(req.body).forEach((key) => {
      if (key !== 'status') form[key] = req.body[key];
    });
    const updatedForm = await form.save();
    res.json(updatedForm);
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE form
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const form = await OpenCourseRequest.findById(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบคำร้องนี้' });
    }
    await form.deleteOne();
    res.json({ message: 'Form deleted' });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE: Cancel a submitted open course request
router.delete('/:id/cancel', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      console.log('No userId provided, rejecting request');
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const form = await OpenCourseRequest.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    console.log('Cancel open course request:', {
      requestId: req.params.id,
      userId: userId,
      requestUserId: form.userId.toString(),
      status: form.status,
    });
    if (form.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ยกเลิกคำร้องนี้' });
    }
    if (!['pending_advisor', 'advisor_approved'].includes(form.status)) {
      return res.status(400).json({ message: 'สามารถยกเลิกได้เฉพาะคำร้องที่อยู่ในสถานะรอพิจารณาเท่านั้น' });
    }
    await OpenCourseRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'ยกเลิกคำร้องสำเร็จ' });
  } catch (error) {
    console.error('Error canceling open course request:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET generate PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const request = await OpenCourseRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงคำร้องนี้' });
    }
    if (!['advisor_approved', 'head_approved'].includes(request.status)) {
      return res.status(400).json({ message: 'คำร้องนี้ยังไม่ได้รับการอนุมัติ' });
    }
    const templatePath = path.join(__dirname, '../templates/RE.07-คำร้องขอเปิดรายวิชานอกแผนการเรียน.pdf');
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);
    const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');
    const fontBytes = await fs.readFile(fontPath);
    const thaiFont = await pdfDoc.embedFont(fontBytes);
    const page = pdfDoc.getPages()[0];
    const fontSize = 14;
    const textColor = rgb(0, 0, 0);
    const drawText = (text, x, y, size = fontSize) => {
      page.drawText(text || '', {
        x,
        y,
        size,
        font: thaiFont,
        color: textColor,
      });
    };
    drawText(request.semester || '', 402.88, 769.43);
    drawText(request.academicYear || '', 485.35, 769.43);
    drawText(request.date || '', 333.90, 731.43);
    drawText(request.month || '', 381.88, 731.43);
    drawText(request.year || '', 455.86, 731.43);
    drawText(request.dean || 'คณบดีคณะวิศวกรรมศาสตร์', 133.96, 711.43);
    drawText(request.studentName || '', 205.44, 682.43);
    drawText(request.studentId || '', 443.87, 682.43);
    drawText(request.faculty || '', 111.47, 631.43);
    drawText(request.fieldOfStudy || '', 356.39, 631.43);
    drawText(request.semester || '', 422.87, 604.43);
    drawText(request.academicYear || '', 514.84, 604.43);
    drawText(request.courseCode || '', 115.47, 582.43);
    drawText(request.courseTitle || '', 286.91, 582.43);
    if (request.reason) {
      const reasonLines = request.reason.match(/.{1,50}/g) || [request.reason];
      reasonLines.forEach((line, index) => {
        drawText(line, 98.47, 553.43 - index * 20);
      });
    }
    drawText(request.contactNumber || '', 99.47, 486.43);
    drawText(request.email || '', 99.97, 472.43);
    drawText(request.signature || request.studentName || '', 385.97, 477.43);
    const pdfBytesModified = await pdfDoc.save();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=RE07_${id}.pdf`
    });
    res.send(Buffer.from(pdfBytesModified));
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;