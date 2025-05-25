const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AddSeatRequest = require('../models/AddSeatRequest');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');

// Middleware เพื่อตรวจสอบว่าเป็น instructor
// const ensureInstructor = (req, res, next) => {
//   if (req.user && req.user.role === 'instructor') {
//     return next();
//   }
//   res.status(403).json({ message: 'เฉพาะอาจารย์ประจำวิชาเท่านั้น' });
// };

// const ensureAuthenticated = (req, res, next) => {
//   if (req.user) {
//     return next();
//   }
//   res.status(401).json({ message: 'กรุณาล็อกอินเพื่อเข้าถึงทรัพยากรนี้' });
// };

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

// GET all draft forms for a user
router.get('/drafts/:userId', async (req, res) => {
  try {
    const drafts = await AddSeatRequest.find({
      userId: req.params.userId,
      status: 'draft'
    }).select('courseCode courseTitle semester academicYear createdAt');
    const count = drafts.length;
    res.json({ drafts, count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET all add seat requests
router.get('/', async (req, res) => {
  try {
    const requests = await AddSeatRequest.find().select('-__v');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET เพิ่มคำขอที่นั่งสำหรับผู้ใช้เฉพาะ (นักเรียนสามารถเข้าถึงได้)
router.get('/user/:userId', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.params.userId;
    // Ensure the authenticated user is fetching their own data
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลของผู้ใช้คนอื่น' });
    }
    const requests = await AddSeatRequest.find({ userId, status: { $ne: 'draft' } }).select('-__v');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET add seat requests for instructors
router.get('/addseatrequests', ensureInstructor, async (req, res) => {
  try {
    const requests = await AddSeatRequest.find({ status: 'submitted' }).select('-__v');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET add seat request by ID
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const request = await AddSeatRequest.findById(req.params.id).select('-__v');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST submit add seat request
router.post('/', async (req, res) => {
  try {
    const request = new AddSeatRequest({
      ...req.body,
      status: 'submitted'
    });
    const savedRequest = await request.save();
    res.status(201).json(savedRequest);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST save draft
router.post('/draft', async (req, res) => {
  try {
    if (!req.body.userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const request = new AddSeatRequest({
      ...req.body,
      status: 'draft'
    });
    const savedRequest = await request.save();
    const draftCount = await AddSeatRequest.countDocuments({
      userId: req.body.userId,
      status: 'draft'
    });
    res.status(201).json({ form: savedRequest, draftCount });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update add seat request
router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const request = await AddSeatRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    Object.keys(req.body).forEach(key => {
      if (key !== 'status') request[key] = req.body[key];
    });

    const updatedRequest = await request.save();
    res.json(updatedRequest);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE add seat request
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const request = await AddSeatRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    await request.deleteOne();
    res.json({ message: 'Request deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST approve add seat request
router.post('/:id/approve', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
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
    res.status(500).json({ message: error.message });
  }
});

// POST reject add seat request
router.post('/:id/reject', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
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
    res.status(500).json({ message: error.message });
  }
});

// GET generate PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const request = await AddSeatRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'ไม่พบคำร้อง' });
    }

    if (request.status !== 'instructor_approved') {
      return res.status(400).json({ message: 'คำร้องนี้ยังไม่ได้รับการอนุมัติ' });
    }

    // โหลดไฟล์ PDF template
    const templatePath = path.join(__dirname, '../templates/RE.06-คำร้องขอเพิ่มที่นั่ง.pdf'); 
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // โหลดฟอนต์
    pdfDoc.registerFontkit(fontkit);
    const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');
    const fontBytes = await fs.readFile(fontPath);
    const thaiFont = await pdfDoc.embedFont(fontBytes);

    // ดึงหน้าแรก
    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();

    // ฟังก์ชันสำหรับเขียนข้อความ
   // ฟังก์ชันสำหรับเขียนข้อความ
const drawText = (text, x, y, size = 16, maxWidth = Infinity) => {
  // ถ้าข้อความยาวเกิน maxWidth ให้ตัดข้อความ
  let displayText = text;
  let currentWidth = thaiFont.widthOfTextAtSize(text, size);

  if (currentWidth > maxWidth) {
    let truncatedText = text;
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
    color: require('pdf-lib').rgb(0, 0, 0),
  });
};

    // กรอกข้อมูลลงใน PDF
    drawText(request.semester, 344.00, 773.43); // ภาคการศึกษา
    drawText(request.academicYear, 436.80, 773.43); // ปีการศึกษา
    drawText(request.date, 391.20, 736.43); // วันที่
    drawText(request.month,443.52, 736.43); // เดือน
    drawText(request.year, 517.76, 736.43); // ปี
    drawText(request.lecturer, 183.04, 706.60); // เรียน
    drawText(request.studentName, 206.72, 673.96); // ชื่อ-นามสกุล
    drawText(request.studentId, 474.88, 673.96); // รหัสนักศึกษา
    drawText(request.levelOfStudy, 170, 235); // ระดับการศึกษา
    drawText(request.faculty, 132.48, 619.56); // คณะ
    drawText(request.fieldOfStudy, 353.28, 619.56); // สาขาวิชา
    drawText(request.classLevel, 527.48, 619.56); // ชั้นปี
    drawText(request.courseCode, 53.12, 462.40); // รหัสวิชา
    drawText(request.courseTitle, 157.44, 462.40, 14, 250); // ชื่อวิชา
    drawText(request.section, 330.40, 462.40); // กลุ่มเรียน
    // drawText(request.credits, 450, 340); // หน่วยกิต
    drawText(request.day, 382.84, 462.40); // ยอดลงทะเบียน
    // drawText(request.time, 510, 340); // เวลา
    // drawText(request.room, 550, 340); // ห้อง
    drawText(request.contactNumber, 106.88, 332.20); // เบอร์โทร
    drawText(request.email, 106.88, 314.28); // อีเมล
    drawText(request.signature, 389.76, 340.52); // ลงชื่อ

    // บันทึก PDF
    const pdfBytesModified = await pdfDoc.save();

    // ส่ง PDF กลับไปยัง client
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