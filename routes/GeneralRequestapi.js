const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GeneralRequest = require('../models/GeneralRequest');
const User = require('../models/User');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const fontkit = require('fontkit');
const path = require('path');

// POST: Create a new general request (draft or submitted)
router.post('/', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const {
      date,
      month,
      year,
      studentId,
      fullName,
      faculty,
      fieldOfStudy,
      petitionType,
      details,
      contactNumber,
      email,
      signature,
      status = 'pending_advisor',
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }
    if (user.email !== email) {
      return res.status(403).json({ message: 'ไม่สามารถยื่นคำร้องสำหรับอีเมลอื่นได้' });
    }

    const generalRequest = new GeneralRequest({
      user: userId,
      email,
      date,
      month,
      year,
      studentId,
      fullName,
      faculty,
      fieldOfStudy,
      petitionType,
      details,
      contactNumber,
      signature,
      status,
    });

    const savedRequest = await generalRequest.save();
    res.status(201).json(savedRequest);
  } catch (error) {
    console.error('Error creating general request:', error);
    res.status(400).json({ message: error.message });
  }
});

// GET: Fetch all drafts for the user
router.get('/drafts', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const drafts = await GeneralRequest.find({
      user: userId,
      status: 'draft',
    }).sort({ createdAt: -1 });
    res.json(drafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET: Fetch all submitted requests for a user by userId
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const requests = await GeneralRequest.find({
      user: userId,
      status: { $ne: 'draft' },
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching general requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET: Fetch a specific request by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.user.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงคำร้องนี้' });
    }
    res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET: Fetch pending requests for advisor
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
    const requests = await GeneralRequest.find({
      status: 'pending_advisor',
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching advisor pending requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET: Fetch advisor-approved requests for head
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
    const requests = await GeneralRequest.find({
      status: 'advisor_approved',
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching head pending requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST: Advisor approve request
router.post('/:id/approve', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'advisor') {
      return res.status(403).json({ message: 'เฉพาะอาจารย์ที่ปรึกษาเท่านั้นที่สามารถอนุมัติได้' });
    }
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.status !== 'pending_advisor') {
      return res.status(400).json({ message: 'คำร้องนี้ไม่อยู่ในสถานะรอพิจารณาโดยอาจารย์ที่ปรึกษา' });
    }
    const { comment } = req.body;
    request.status = 'advisor_approved';
    request.advisorComment = comment || '';
    await request.save();
    res.json({ message: 'อนุมัติคำร้องเรียบร้อยแล้ว', request });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST: Advisor reject request
router.post('/:id/reject', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'advisor') {
      return res.status(403).json({ message: 'เฉพาะอาจารย์ที่ปรึกษาเท่านั้นที่สามารถปฏิเสธได้' });
    }
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.status !== 'pending_advisor') {
      return res.status(400).json({ message: 'คำร้องนี้ไม่อยู่ในสถานะรอพิจารณาโดยอาจารย์ที่ปรึกษา' });
    }
    const { comment } = req.body;
    request.status = 'advisor_rejected';
    request.advisorComment = comment || '';
    await request.save();
    res.json({ message: 'ปฏิเสธคำร้องเรียบร้อยแล้ว', request });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST: Head approve request
router.post('/:id/head/approve', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'head') {
      return res.status(403).json({ message: 'เฉพาะหัวหน้าสาขาเท่านั้นที่สามารถอนุมัติได้' });
    }
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.status !== 'advisor_approved') {
      return res.status(400).json({ message: 'คำร้องนี้ไม่อยู่ในสถานะรอพิจารณาโดยหัวหน้าสาขา' });
    }
    const { comment } = req.body;
    request.status = 'head_approved';
    request.headComment = comment || '';
    await request.save();
    res.json({ message: 'อนุมัติคำร้องเรียบร้อยแล้ว', request });
  } catch (error) {
    console.error('Error approving head request:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST: Head reject request
router.post('/:id/head/reject', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'head') {
      return res.status(403).json({ message: 'เฉพาะหัวหน้าสาขาเท่านั้นที่สามารถปฏิเสธได้' });
    }
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.status !== 'advisor_approved') {
      return res.status(400).json({ message: 'คำร้องนี้ไม่อยู่ในสถานะรอพิจารณาโดยหัวหน้าสาขา' });
    }
    const { comment } = req.body;
    request.status = 'head_rejected';
    request.headComment = comment || '';
    await request.save();
    res.json({ message: 'ปฏิเสธคำร้องเรียบร้อยแล้ว', request });
  } catch (error) {
    console.error('Error rejecting head request:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT: Update a general request
router.put('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const updates = req.body;
    delete updates.user;
    delete updates.email;

    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.user.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์อัปเดตคำร้องนี้' });
    }
    if (request.status !== 'draft') {
      return res.status(400).json({ message: 'สามารถแก้ไขได้เฉพาะคำร้องในสถานะร่างเท่านั้น' });
    }

    const updatedRequest = await GeneralRequest.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    res.json(updatedRequest);
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE: Delete a draft
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.user.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบคำร้องนี้' });
    }
    if (request.status !== 'draft') {
      return res.status(400).json({ message: 'สามารถลบได้เฉพาะคำร้องในสถานะร่างเท่านั้น' });
    }
    await GeneralRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'ลบคำร้องสำเร็จ' });
  } catch (error) {
    console.error('Error deleting draft:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE: Cancel a submitted request
router.delete('/:id/cancel', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      console.log('No userId provided, rejecting request');
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    console.log('Cancel general request:', {
      requestId: req.params.id,
      userId: userId,
      requestUser: request.user.toString(),
      status: request.status,
    });
    if (request.user.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ยกเลิกคำร้องนี้' });
    }
    if (!['pending_advisor', 'advisor_approved'].includes(request.status)) {
      return res.status(400).json({ message: 'สามารถยกเลิกได้เฉพาะคำร้องที่อยู่ในสถานะรอพิจารณาเท่านั้น' });
    }
    await GeneralRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'ยกเลิกคำร้องสำเร็จ' });
  } catch (error) {
    console.error('Error canceling general request:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET: สร้างและดาวน์โหลด PDF สำหรับคำร้องที่อนุมัติแล้ว
router.get('/:id/pdf', async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'รูปแบบ requestId หรือ userId ไม่ถูกต้อง' });
    }
    const request = await GeneralRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.user.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงคำร้องนี้' });
    }
    if (request.status !== 'head_approved') {
      return res.status(400).json({ message: 'สามารถดาวน์โหลด PDF ได้เฉพาะคำร้องที่ได้รับการอนุมัติจากหัวหน้าสาขา' });
    }
    const templatePath = path.join(__dirname, '../templates/RE.01-คำร้องทั่วไป.pdf');
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');
    const fontBytes = await fs.readFile(fontPath);
    pdfDoc.registerFontkit(fontkit);
    const thaiFont = await pdfDoc.embedFont(fontBytes);
    const page = pdfDoc.getPages()[0];
    const petitionTypeText = request.petitionType === 'request_leave' ? 'ขอลา' :
                            request.petitionType === 'request_transcript' ? 'ขอใบระเบียนผลการศึกษา' :
                            request.petitionType === 'request_change_course' ? 'ขอเปลี่ยนแปลงรายวิชา' : 'อื่นๆ';
    const fullNameText = request.fullName;
    const studentIdText = request.studentId;
    const facultyText = request.faculty;
    const fieldOfStudyText = request.fieldOfStudy;
    const detailsText = request.details;
    const contactNumberText = request.contactNumber;
    const emailText = request.email;
    const dayText = request.date;
    const monthText = request.month;
    const yearText = request.year;
    page.drawText(petitionTypeText, { x: 81.28, y: 717.76, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    page.drawText(dayText, { x: 344.32, y: 743.72, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    page.drawText(monthText, { x: 397.44, y: 743.72, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    page.drawText(yearText, { x: 474.24, y: 743.72, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    page.drawText(fullNameText, { x: 198.12, y: 663.36, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    page.drawText(studentIdText, { x: 460.80, y: 663.36, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    page.drawText(facultyText, { x: 112.00, y: 609.32, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    page.drawText(fieldOfStudyText, { x: 344.32, y: 609.32, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    page.drawText(detailsText, { x: 149.76, y: 581.16, size: 14, font: thaiFont, color: rgb(0, 0, 0), maxWidth: 400 });
    page.drawText(contactNumberText, { x: 112.64, y: 507.56, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    page.drawText(emailText, { x: 112.64, y: 489.64, size: 14, font: thaiFont, color: rgb(0, 0, 0) });
    const pdfBytesModified = await pdfDoc.save();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=general_request_${request._id}.pdf`
    });
    res.send(Buffer.from(pdfBytesModified));
  } catch (error) {
    console.error('Error generating PDF:', { message: error.message, stack: error.stack, requestId, userId });
    res.status(500).json({ message: `เกิดข้อผิดพลาดในการสร้าง PDF: ${error.message}` });
  }
});

module.exports = router;