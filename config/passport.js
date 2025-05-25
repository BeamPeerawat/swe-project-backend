const passport = require('passport');
   const GoogleStrategy = require('passport-google-oauth20').Strategy;
   const User = require('../models/User');
   require('dotenv').config();

   passport.use(
     new GoogleStrategy(
       {
         clientID: process.env.GOOGLE_CLIENT_ID,
         clientSecret: process.env.GOOGLE_CLIENT_SECRET,
         callbackURL: process.env.GOOGLE_REDIRECT_URI,
       },
       async (accessToken, refreshToken, profile, done) => {
         try {
           const email = profile.emails[0].value;
           // ตรวจสอบว่าเป็นอีเมล @rmuti.ac.th
           if (!email.endsWith('@rmuti.ac.th')) {
             return done(null, false, { message: 'กรุณาใช้อีเมลที่ลงท้ายด้วย @rmuti.ac.th' });
           }

           // ค้นหาหรือสร้างผู้ใช้
           let user = await User.findOne({ email });
           if (!user) {
             user = new User({
               name: profile.displayName || email.split('@')[0],
               email,
               googleId: profile.id,
             });
             await user.save();
           }

           return done(null, user);
         } catch (error) {
           return done(error, null);
         }
       }
     )
   );

   passport.serializeUser((user, done) => {
     done(null, user.id);
   });

   passport.deserializeUser(async (id, done) => {
     try {
       const user = await User.findById(id);
       done(null, user);
     } catch (error) {
       done(error, null);
     }
   });

   module.exports = passport;