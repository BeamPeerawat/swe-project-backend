const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const subjectRoutes = require('./routes/subjectapi');
const addSeatRequestRoutes = require('./routes/AddSeatRequestapi');
const openCourseRequestRoutes = require('./routes/OpenCourseRequest');
const generalRequestRoutes = require('./routes/GeneralRequestapi');

const app = express();

// เชื่อมต่อ MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: 'https://swe-project-frontend.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://swe-project-frontend.vercel.app');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie');
  next();
}));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60 // 24 hours
    }),
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log('Cookies:', req.headers.cookie || 'No cookies');
  console.log('Session ID:', req.sessionID || 'No session ID');
  next();
});

// Routes
app.use('/api', apiRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/addseatrequests', addSeatRequestRoutes);
app.use('/api/opencourserequests', openCourseRequestRoutes);
app.use('/api/generalrequests', generalRequestRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});