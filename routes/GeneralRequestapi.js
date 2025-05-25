// SWE Project Backend\routes\GeneralRequestapi.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GeneralRequest = require('../models/GeneralRequest');
const User = require('../models/User');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const fontkit = require('fontkit');
const path = require('path'); // เพิ่ม path

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

// GET: Fetch all submitted requests for a user by userId
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'ต้องระบุ userId' });
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
router.get('/:id/pdf', async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.query.userId;

    // ตรวจสอบ ObjectId
    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'รูปแบบ requestId หรือ userId ไม่ถูกต้อง' });
    }

    // ค้นหาคำร้อง
    const request = await GeneralRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }

    // ตรวจสอบ owner
    if (request.user.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงคำร้องนี้' });
    }

    // ตรวจสอบ status
    if (request.status !== 'head_approved') {
      return res.status(400).json({ message: 'สามารถดาวน์โหลด PDF ได้เฉพาะคำร้องที่ได้รับการอนุมัติจากหัวหน้าสาขา' });
    }

    // กำหนด paths
    const templatePath = path.join(__dirname, '../templates/RE.01-คำร้องทั่วไป.pdf');
    const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');

    // ตรวจสอบไฟล์
    try {
      await fs.access(templatePath);
      await fs.access(fontPath);
    } catch (error) {
      console.error('File access error:', { templatePath, fontPath, error: error.message });
      return res.status(500).json({ message: `ไม่พบไฟล์: ${error.message}` });
    }

    // โหลด PDF
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // โหลดฟอนต์
    pdfDoc.registerFontkit(fontkit);
    const fontBytes = await fs.readFile(fontPath);
    const thaiFont = await pdfDoc.embedFont(fontBytes);

    // เข้าถึงหน้าแรก
    const page = pdfDoc.getPages()[0];

    // ฟังก์ชัน drawText
    const drawText = (text, x, y, size = 14, maxWidth = Infinity) => {
      let displayText = text || '';
      if (maxWidth !== Infinity) {
        let currentWidth = thaiFont.widthOfTextAtSize(displayText, size);
        if (currentWidth > maxWidth) {
          let truncatedText = displayText;
          while (thaiFont.widthOfTextAtSize(truncatedText + '...', size) > maxWidth && truncatedText.length > 0) {
            truncatedText = truncatedText.slice(0, -1);
          }
          displayText = truncatedText + '...';
        }
      }
      page.drawText(displayText, { x, y, size, font: thaiFont, color: rgb(0, 0, 0) });
    };

    // กำหนดข้อมูล
    const petitionTypeText = request.petitionType === 'request_leave' ? 'ขอลา' :
                            request.petitionType === 'request_transcript' ? 'ขอใบระเบียนผลการศึกษา' :
                            request.petitionType === 'request_change_course' ? 'ขอเปลี่ยนแปลงรายวิชา' : 'อื่นๆ';

    // วาดข้อความ
    drawText(petitionTypeText, 81.28, 717.76);
    drawText(request.date || '', 344.32, 743.72);
    drawText(request.month || '', 397.44, 743.72);
    drawText(request.year || '', 474.24, 743.72);
    drawText(request.fullName || '', 198.12, 663.36);
    drawText(request.studentId || '', 460.80, 663.36);
    drawText(request.faculty || '', 112.00, 609.32);
    drawText(request.fieldOfStudy || '', 344.32, 609.32);
    drawText(request.details || '', 149.76, 581.16, 14, 400);
    drawText(request.contactNumber || '', 112.64, 507.56);
    drawText(request.email || '', 112.64, 489.64);

    // บันทึกและส่ง PDF
    const pdfBytesModified = await pdfDoc.save();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=general_request_${request._id}.pdf`
    });
    res.send(Buffer.from(pdfBytesModified));
  } catch (error) {
    console.error('Error generating PDF:', {
      message: error.message,
      stack: error.stack,
      requestId,
      userId
    });
    res.status(500).json({ message: `เกิดข้อผิดพลาดในการสร้าง PDF: ${error.message}` });
  }
});

module.exports = router;