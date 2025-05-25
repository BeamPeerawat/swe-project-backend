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

// Middleware
app.use(cors({
  origin: ['https://swe-project-frontend.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json());
app.use(
  session({
    secret: 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions'
    }),
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', 'https://swe-project-frontend.vercel.app');
  next();
});

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