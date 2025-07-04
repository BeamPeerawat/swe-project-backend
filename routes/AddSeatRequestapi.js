const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AddSeatRequest = require('../models/AddSeatRequest');
const User = require('../models/User');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');

// GET all draft forms for a user
router.get('/drafts', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const drafts = await AddSeatRequest.find({
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

// GET all add seat requests
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const requests = await AddSeatRequest.find({ userId }).select('-__v');
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET add seat requests for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId format' });
    }
    const requests = await AddSeatRequest.find({
      userId,
      status: { $ne: 'draft' },
    }).select('-__v');
    res.json(requests);
  } catch (error) {
    console.error('Error fetching user requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET add seat requests for instructors
router.get('/addseatrequests', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'instructor') {
      return res.status(403).json({ message: 'เฉพาะอาจารย์ประจำวิชาเท่านั้น' });
    }
    const requests = await AddSeatRequest.find({ status: 'submitted' }).select('-__v');
    res.json(requests);
  } catch (error) {
    console.error('Error fetching instructor requests:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET add seat request by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const request = await AddSeatRequest.findById(req.params.id).select('-__v');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงคำร้องนี้' });
    }
    res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST submit add seat request
router.post('/', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user || user.role !== 'student') {
      return res.status(403).json({ message: 'เฉพาะนักศึกษาเท่านั้นที่สามารถยื่นคำร้องได้' });
    }
    const request = new AddSeatRequest({
      ...req.body,
      userId,
      status: 'submitted',
    });
    const savedRequest = await request.save();
    res.status(201).json(savedRequest);
  } catch (error) {
    console.error('Error submitting request:', error);
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
    const request = new AddSeatRequest({
      ...req.body,
      userId,
      status: 'draft',
    });
    const savedRequest = await request.save();
    const draftCount = await AddSeatRequest.countDocuments({
      userId,
      status: 'draft',
    });
    res.status(201).json({ form: savedRequest, draftCount });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(400).json({ message: error.message });
  }
});

// PUT update add seat request
router.put('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const request = await AddSeatRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์อัปเดตคำร้องนี้' });
    }
    Object.keys(req.body).forEach((key) => {
      if (key !== 'status') request[key] = req.body[key];
    });
    const updatedRequest = await request.save();
    res.json(updatedRequest);
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE add seat request
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const request = await AddSeatRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบคำร้องนี้' });
    }
    await request.deleteOne();
    res.json({ message: 'Request deleted' });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST approve add seat request
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
    if (!user || user.role !== 'instructor') {
      return res.status(403).json({ message: 'เฉพาะอาจารย์ประจำวิชาเท่านั้นที่สามารถอนุมัติได้' });
    }
    const request = await AddSeatRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'submitted') {
      return res.status(400).json({ message: 'Request is not in submitted status' });
    }
    request.status = 'instructor_approved';
    request.instructorComment = req.body.comment || '';
    const updatedRequest = await request.save();
    res.json(updatedRequest);
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST reject add seat request
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
    if (!user || user.role !== 'instructor') {
      return res.status(403).json({ message: 'เฉพาะอาจารย์ประจำวิชาเท่านั้นที่สามารถปฏิเสธได้' });
    }
    const request = await AddSeatRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'submitted') {
      return res.status(400).json({ message: 'Request is not in submitted status' });
    }
    request.status = 'instructor_rejected';
    request.instructorComment = req.body.comment || '';
    const updatedRequest = await request.save();
    res.json(updatedRequest);
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE: Cancel a submitted add seat request
router.delete('/:id/cancel', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      console.log('No userId provided, rejecting request');
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const request = await AddSeatRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    console.log('Cancel add seat request:', {
      requestId: req.params.id,
      userId: userId,
      requestUserId: request.userId.toString(),
      status: request.status,
    });
    if (request.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ยกเลิกคำร้องนี้' });
    }
    if (!['submitted', 'instructor_approved'].includes(request.status)) {
      return res.status(400).json({ message: 'สามารถยกเลิกได้เฉพาะคำร้องที่อยู่ในสถานะรอพิจารณาหรืออนุมัติแล้วเท่านั้น' });
    }
    await AddSeatRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'ยกเลิกคำร้องสำเร็จ' });
  } catch (error) {
    console.error('Error canceling add seat request:', error);
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
    const request = await AddSeatRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }
    if (request.userId.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงคำร้องนี้' });
    }
    if (request.status !== 'instructor_approved') {
      return res.status(400).json({ message: 'คำร้องนี้ยังไม่ได้รับการอนุมัติ' });
    }
    const templatePath = path.join(__dirname, '../templates/RE.06-คำร้องขอเพิ่มที่นั่ง.pdf');
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);
    const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');
    const fontBytes = await fs.readFile(fontPath);
    const thaiFont = await pdfDoc.embedFont(fontBytes);
    const page = pdfDoc.getPages()[0];
    const drawText = (text, x, y, size = 16, maxWidth = Infinity) => {
      let displayText = text || '';
      let currentWidth = thaiFont.widthOfTextAtSize(displayText, size);
      if (currentWidth > maxWidth) {
        let truncatedText = displayText;
        while (thaiFont.widthOfTextAtSize(truncatedText + '...', size) > maxWidth && truncatedText.length > 0) {
          truncatedText = truncatedText.slice(0, -1);
        }
        displayText = truncatedText + '...';
      }
      page.drawText(displayText, {
        x,
        y,
        size,
        font: thaiFont,
        color: rgb(0, 0, 0),
      });
    };
    drawText(request.semester, 344.00, 773.43);
    drawText(request.academicYear, 436.80, 773.43);
    drawText(request.date, 391.20, 736.43);
    drawText(request.month, 443.52, 736.43);
    drawText(request.year, 517.76, 736.43);
    drawText(request.lecturer, 183.04, 706.60);
    drawText(request.studentName, 206.72, 673.96);
    drawText(request.studentId, 474.88, 673.96);
    drawText(request.levelOfStudy, 170, 235);
    drawText(request.faculty, 132.48, 619.56);
    drawText(request.fieldOfStudy, 353.28, 619.56);
    drawText(request.classLevel, 527.48, 619.56);
    drawText(request.courseCode, 53.12, 462.40);
    drawText(request.courseTitle, 157.44, 462.40, 14, 250);
    drawText(request.section, 330.40, 462.40);
    drawText(request.day, 382.84, 462.40);
    drawText(request.contactNumber, 106.88, 332.20);
    drawText(request.email, 106.88, 314.28);
    drawText(request.signature, 389.76, 340.52);
    const pdfBytesModified = await pdfDoc.save();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=RE06_${id}.pdf`,
    });
    res.send(Buffer.from(pdfBytesModified));
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;