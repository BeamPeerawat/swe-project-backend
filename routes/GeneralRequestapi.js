// SWE Project Backend\routes\GeneralRequestapi.js
const express = require('express');
const router = express.Router();
const GeneralRequest = require('../models/GeneralRequest');
const User = require('../models/User');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const fontkit = require('fontkit');

// Middleware to ensure user is authenticated and has the correct role
const ensureAuthenticatedAndRole = (roles) => {
  return (req, res, next) => {
    console.log('Authenticated:', req.isAuthenticated());
    console.log('User:', req.user);
    if (req.isAuthenticated() && roles.includes(req.user.role)) {
      return next();
    }
    res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงทรัพยากรนี้' });
  };
};

const ensureAuthenticated = (req, res, next) => {
  console.log('Authenticated:', req.isAuthenticated());
  console.log('User:', req.user);
  if (req.user) {
    return next();
  }
  res.status(401).json({ message: 'กรุณาล็อกอินเพื่อเข้าถึงทรัพยากรนี้' });
};

// POST: Create a new general request (draft or submitted)
router.post('/', ensureAuthenticatedAndRole(['student']), async (req, res) => {
  try {
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
      status = 'pending_advisor', // Default to pending_advisor for submitted requests
    } = req.body;

    // Validate email matches authenticated user
    if (req.user.email !== email) {
      return res.status(403).json({ message: 'ไม่สามารถยื่นคำร้องสำหรับอีเมลอื่นได้' });
    }

    // Verify user exists
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }

    const generalRequest = new GeneralRequest({
      user: req.user._id,
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
    res.status(400).json({ message: error.message });
  }
});

// GET: Fetch all drafts for the authenticated student
router.get('/drafts', ensureAuthenticatedAndRole(['student']), async (req, res) => {
  try {
    const drafts = await GeneralRequest.find({
      user: req.user._id,
      status: 'draft',
    }).sort({ createdAt: -1 });
    res.json(drafts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET: Fetch all submitted requests for the authenticated student
router.get('/', ensureAuthenticatedAndRole(['student']), async (req, res) => {
  try {
    const requests = await GeneralRequest.find({
      user: req.user._id,
      status: { $ne: 'draft' },
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET: Fetch a specific request by ID
router.get('/:id', ensureAuthenticatedAndRole(['student', 'advisor', 'head']), async (req, res) => {
  try {
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    // Students can only view their own requests
    if (req.user.role === 'student' && request.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงคำร้องนี้' });
    }
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET: Fetch pending requests for advisor
router.get('/advisor/pending', ensureAuthenticatedAndRole(['advisor']), async (req, res) => {
  try {
    const requests = await GeneralRequest.find({
      status: 'pending_advisor',
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET: Fetch advisor-approved requests for head
router.get('/head/pending', ensureAuthenticatedAndRole(['head']), async (req, res) => {
  try {
    const requests = await GeneralRequest.find({
      status: 'advisor_approved',
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST: Advisor approve request
router.post('/:id/approve', ensureAuthenticatedAndRole(['advisor']), async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
});

// POST: Advisor reject request
router.post('/:id/reject', ensureAuthenticatedAndRole(['advisor']), async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
});

// POST: Head approve request
router.post('/:id/head/approve', ensureAuthenticatedAndRole(['head']), async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
});

// POST: Head reject request
router.post('/:id/head/reject', ensureAuthenticatedAndRole(['head']), async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
});

// PUT: Update a general request
router.put('/:id', ensureAuthenticatedAndRole(['student']), async (req, res) => {
  try {
    const updates = req.body;

    // Prevent updating user or email fields
    delete updates.user;
    delete updates.email;

    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }

    // Ensure the request belongs to the authenticated user
    if (request.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์อัปเดตคำร้องนี้' });
    }

    // Only allow updates if the request is in draft status
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
    res.status(400).json({ message: error.message });
  }
});

// DELETE: Delete a draft
router.delete('/:id', ensureAuthenticatedAndRole(['student']), async (req, res) => {
  try {
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบคำร้องนี้' });
    }
    if (request.status !== 'draft') {
      return res.status(400).json({ message: 'สามารถลบได้เฉพาะคำร้องในสถานะร่างเท่านั้น' });
    }
    await GeneralRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'ลบคำร้องสำเร็จ' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE: Cancel a submitted request
router.delete('/:id/cancel', ensureAuthenticatedAndRole(['student']), async (req, res) => {
  try {
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ยกเลิกคำร้องนี้' });
    }
    if (!['pending_advisor', 'advisor_approved'].includes(request.status)) {
      return res.status(400).json({ message: 'สามารถยกเลิกได้เฉพาะคำร้องที่อยู่ในสถานะรอพิจารณาเท่านั้น' });
    }
    await GeneralRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'ยกเลิกคำร้องสำเร็จ' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET: สร้างและดาวน์โหลด PDF สำหรับคำร้องที่อนุมัติแล้ว
router.get('/:id/pdf', ensureAuthenticatedAndRole(['student']), async (req, res) => {
  try {
    const request = await GeneralRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    // ตรวจสอบว่าเป็นคำร้องของผู้ใช้และอยู่ในสถานะ head_approved
    if (request.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงคำร้องนี้' });
    }
    if (request.status !== 'head_approved') {
      return res.status(400).json({ message: 'สามารถดาวน์โหลด PDF ได้เฉพาะคำร้องที่ได้รับการอนุมัติจากหัวหน้าสาขา' });
    }

    // โหลด PDF ต้นฉบับ
    const pdfPath = 'templates/RE.01-คำร้องทั่วไป.pdf';
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // โหลดฟอนต์ภาษาไทย
    const fontBytes = await fs.readFile('fonts/THSarabunNew.ttf');
    pdfDoc.registerFontkit(fontkit); // ต้องติดตั้ง fontkit ถ้าใช้ฟอนต์แบบกำหนดเอง
    const thaiFont = await pdfDoc.embedFont(fontBytes);

    // เข้าถึงหน้าแรกของ PDF
    const page = pdfDoc.getPages()[0];

    // กำหนดข้อมูลที่จะเติม
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

// แยกวัน เดือน ปี ออกเป็นตัวแปร
const dayText = request.date;
const monthText = request.month;
const yearText = request.year;

// วาดข้อความลงใน PDF
// เรื่อง
page.drawText(petitionTypeText, {
  x: 81.28,
  y: 717.76,
  size: 14,
  font: thaiFont,
  color: rgb(0, 0, 0),
});

// วัน
page.drawText(dayText, {
  x: 344.32, // ปรับตำแหน่งตามช่องวันในฟอร์ม
  y: 743.72,
  size: 14,
  font: thaiFont,
  color: rgb(0, 0, 0),
});

// เดือน
page.drawText(monthText, {
  x: 397.44, // เลื่อน x เพื่อให้แยกจากวัน
  y: 743.72,
  size: 14,
  font: thaiFont,
  color: rgb(0, 0, 0),
});

// ปี
page.drawText(yearText, {
  x: 474.24, // เลื่อน x อีกเพื่อให้แยกจากเดือน
  y: 743.72,
  size: 14,
  font: thaiFont,
  color: rgb(0, 0, 0),
});

    // ชื่อนักศึกษา
    page.drawText(fullNameText, {
      x: 198.12,
      y: 663.36,
      size: 14,
      font: thaiFont,
      color: rgb(0, 0, 0),
    });

    // รหัสนักศึกษา
    page.drawText(studentIdText, {
      x: 460.80,
      y: 663.36,
      size: 14,
      font: thaiFont,
      color: rgb(0, 0, 0),
    });

    // คณะ
    page.drawText(facultyText, {
      x: 112.00,
      y: 609.32,
      size: 14,
      font: thaiFont,
      color: rgb(0, 0, 0),
    });

    // สาขาวิชา
    page.drawText(fieldOfStudyText, {
      x: 344.32,
      y: 609.32,
      size: 14,
      font: thaiFont,
      color: rgb(0, 0, 0),
    });

    // เหตุผล
    page.drawText(detailsText, {
      x: 149.76,
      y: 581.16,
      size: 14,
      font: thaiFont,
      color: rgb(0, 0, 0),
      maxWidth: 400, // ป้องกันข้อความล้น
    });

    // เบอร์โทร
    page.drawText(contactNumberText, {
      x: 112.64,
      y: 507.56,
      size: 14,
      font: thaiFont,
      color: rgb(0, 0, 0),
    });

    // อีเมล
    page.drawText(emailText, {
      x: 112.64,
      y: 489.64,
      size: 14,
      font: thaiFont,
      color: rgb(0, 0, 0),
    });

    // บันทึก PDF
    const pdfBytesModified = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=general_request_${request._id}.pdf`);
    res.send(Buffer.from(pdfBytesModified));
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้าง PDF' });
  }
});


module.exports = router;