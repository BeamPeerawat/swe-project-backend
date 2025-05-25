const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const User = require('../models/User');
const Subject = require('../models/subject');

// Middleware to ensure user is authenticated and authorized
const ensureAuthenticated = async (req, res, next) => {
  const userId = req.query.userId || req.body.userId;
  if (!userId) {
    return res.status(401).json({ message: 'ต้องระบุ userId' });
  }
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }
    req.user = user; // Set req.user for compatibility with existing code
    if (req.user.role === 'admin' || req.user.email === req.params.email) {
      return next();
    }
    return res.status(403).json({ message: 'คุณไม่มีสิทธิ์อัปเดตข้อมูลผู้ใช้นี้' });
  } catch (error) {
    console.error('Error in ensureAuthenticated:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Middleware to ensure user is an admin
const ensureAdmin = async (req, res, next) => {
  const userId = req.query.userId || req.body.userId;
  if (!userId) {
    return res.status(401).json({ message: 'ต้องระบุ userId' });
  }
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }
    req.user = user;
    if (req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' });
  } catch (error) {
    console.error('Error in ensureAdmin:', error);
    return res.status(500).json({ message: error.message });
  }
};

// GET: ดึงข้อมูลผู้ใช้ทั้งหมด
router.get('/users', ensureAdmin, async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET: ดึงข้อมูลผู้ใช้ตาม email
router.get('/user/:email', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }
    if (user._id.toString() !== userId) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้นี้' });
    }
    res.json({
      student_no: user.student_no,
      faculty: user.faculty,
      branch: user.branch,
      contactNumber: user.contactNumber,
      group: user.group,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('Error fetching user by email:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT: อัปเดตข้อมูลผู้ใช้ (ไม่รวม group)
router.put('/user/:email', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const updates = {};
    if (req.body.contactNumber) {
      if (!/^\d{10}$/.test(req.body.contactNumber)) {
        return res.status(400).json({ message: 'เบอร์โทรศัพท์ต้องมี 10 หลักและเป็นตัวเลขเท่านั้น' });
      }
      updates.contactNumber = req.body.contactNumber;
    }
    if (req.body.name) updates.name = req.body.name;
    if (req.body.student_no) updates.student_no = req.body.student_no;
    if (req.body.faculty) updates.faculty = req.body.faculty;
    if (req.body.branch) updates.branch = req.body.branch;
    if (req.body.role && req.user.role === 'admin') updates.role = req.body.role;

    if (req.body.group) {
      return res.status(400).json({ message: 'ไม่สามารถอัปเดตชั้นปีได้' });
    }

    const user = await User.findOneAndUpdate(
      { email: req.params.email, _id: userId },
      { $set: updates },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้หรือไม่มีสิทธิ์' });
    }
    res.json({
      student_no: user.student_no,
      faculty: user.faculty,
      branch: user.branch,
      contactNumber: user.contactNumber,
      group: user.group,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST: สร้างผู้ใช้ใหม่
router.post('/users', async (req, res) => {
  const user = new User({
    name: req.body.name,
    email: req.body.email,
    student_no: req.body.student_no,
    faculty: req.body.faculty,
    branch: req.body.branch,
    contactNumber: req.body.contactNumber,
    group: req.body.group,
    role: req.body.role || 'student',
  });

  try {
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ message: error.message });
  }
});

// Google OAuth routes
router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

// Google OAuth callback
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'https://swe-project-frontend.vercel.app/login' }),
  (req, res) => {
    console.log('Google Callback - User:', req.user);
    console.log('Google Callback - Session ID:', req.sessionID);
    const user = {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      student_no: req.user.student_no,
      faculty: req.user.faculty,
      branch: req.user.branch,
      contactNumber: req.user.contactNumber,
      group: req.user.group,
      role: req.user.role,
    };
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Session save failed' });
      }
      console.log('Redirecting with user:', user);
      res.redirect(`https://swe-project-frontend.vercel.app/login?user=${encodeURIComponent(JSON.stringify(user))}`);
    });
  }
);

// GET: ดึงข้อมูลผู้ใช้ที่ล็อกอิน
router.get('/auth/user', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }
    res.json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        student_no: user.student_no,
        faculty: user.faculty,
        branch: user.branch,
        contactNumber: user.contactNumber,
        group: user.group,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error fetching auth user:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET all users
router.get('/users', ensureAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password -googleId');
    res.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET user by ID
router.get('/users/:id', ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password -googleId');
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    res.json(user);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST create new user
router.post('/users', ensureAdmin, async (req, res) => {
  try {
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: 'อีเมลนี้มีอยู่ในระบบแล้ว' });
    }
    const user = new User({
      email: req.body.email,
      name: req.body.name,
      role: req.body.role,
      faculty: req.body.faculty,
      branch: req.body.branch,
      student_no: req.body.student_no,
    });
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating new user:', error);
    res.status(400).json({ message: error.message });
  }
});

// PUT update user
router.put('/users/:id', ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    if (req.body.email && req.body.email !== user.email) {
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        return res.status(400).json({ message: 'อีเมลนี้มีอยู่ในระบบแล้ว' });
      }
      user.email = req.body.email;
    }
    if (req.body.name) user.name = req.body.name;
    if (req.body.role) user.role = req.body.role;
    if (req.body.faculty) user.faculty = req.body.faculty;
    if (req.body.branch) user.branch = req.body.branch;
    if (req.body.student_no) user.student_no = req.body.student_no;

    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user by ID:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE user
router.delete('/users/:id', ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    if (user.email === req.user.email) {
      return res.status(400).json({ message: 'ไม่สามารถลบตัวเองได้' });
    }
    await user.deleteOne();
    res.json({ message: 'ลบผู้ใช้เรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: error.message });
  }
});

// CHECK if email exists
router.get('/users/check/:email', ensureAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (user) {
      return res.json({ exists: true });
    }
    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET dashboard summary
router.get('/dashboard', ensureAdmin, async (req, res) => {
  try {
    console.log('Fetching dashboard summary...');
    const userCount = await User.countDocuments();
    console.log('User count:', userCount);
    const adminCount = await User.countDocuments({ role: 'admin' });
    console.log('Admin count:', adminCount);
    const studentCount = await User.countDocuments({ role: 'student' });
    console.log('Student count:', studentCount);
    const subjectCount = await Subject.countDocuments();
    console.log('Subject count:', subjectCount);
    const creditsDistribution = await Subject.aggregate([
      {
        $group: {
          _id: '$credits',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]).catch((err) => {
      console.error('Error in creditsDistribution aggregation:', err);
      throw new Error('Failed to aggregate credits distribution');
    });
    console.log('Credits distribution:', creditsDistribution);
    const facultyDistribution = await User.aggregate([
      {
        $group: {
          _id: '$faculty',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]).catch((err) => {
      console.error('Error in facultyDistribution aggregation:', err);
      throw new Error('Failed to aggregate faculty distribution');
    });
    console.log('Faculty distribution:', facultyDistribution);

    res.json({
      userCount,
      adminCount,
      studentCount,
      subjectCount,
      creditsDistribution,
      facultyDistribution,
    });
  } catch (error) {
    console.error('Dashboard endpoint error:', error);
    res.status(500).json({ message: `Failed to fetch dashboard summary: ${error.message}` });
  }
});

// PATCH: เปลี่ยน role ของผู้ใช้
router.patch('/user/:email/role', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(401).json({ message: 'ต้องระบุ userId' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }
    const { role } = req.body;
    if (!['student', 'instructor', 'advisor', 'head', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'role ไม่ถูกต้อง' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยน role ได้' });
    }
    const targetUser = await User.findOneAndUpdate(
      { email: req.params.email },
      { $set: { role } },
      { new: true }
    );
    if (!targetUser) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    }
    res.json({
      student_no: targetUser.student_no,
      faculty: targetUser.faculty,
      branch: targetUser.branch,
      contactNumber: targetUser.contactNumber,
      group: targetUser.group,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
    });
  } catch (error) {
    console.error('Error patching user role:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;