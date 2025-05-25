const express = require('express');
const cors = require('cors');
const MongoStore = require('connect-mongo');
const session = require('express-session');
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

// Configure MongoStore for session storage
const store = MongoStore.create({
  mongoUrl: process.env.MONGO_URI,
  collectionName: 'sessions'
});

store.on('error', (error) => {
  console.error('MongoStore error:', error);
});

// Middleware
app.use(cors({
  origin: 'https://swe-project-frontend.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.options('*', cors()); // จัดการ preflight requests

// Log cookies and session ID
app.use((req, res, next) => {
  console.log('Request URL:', req.method, req.url);
  console.log('Cookies:', req.headers.cookie || 'No cookies');
  console.log('Session ID:', req.sessionID || 'No session ID');
  next();
});

app.use(express.json());
app.use(
  session({
    secret: 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'none' // สำหรับ cross-site requests
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api', apiRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/addseatrequests', addSeatRequestRoutes);
app.use('/api/opencourserequests', openCourseRequestRoutes);
app.use('/api/generalrequests', generalRequestRoutes);

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});