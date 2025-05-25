# ระบบจัดการคำร้องออนไลน์ (Backend)

## คำอธิบายโปรเจกต์

ระบบ Backend สำหรับจัดการคำร้องออนไลน์ของนักศึกษา มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น พัฒนาโดยใช้ Node.js, Express, MongoDB รองรับการยื่นคำร้อง, อนุมัติ, ปฏิเสธ, การจัดการผู้ใช้, การสร้าง PDF และอื่น ๆ

---

## โครงสร้างโฟลเดอร์

- `.env` : ไฟล์สำหรับเก็บ Environment Variables เช่น ค่าการเชื่อมต่อฐานข้อมูล, Secret ต่าง ๆ
- `package.json` : รายการ dependencies และ script สำหรับรันโปรเจกต์
- `server.js` : จุดเริ่มต้นของเซิร์ฟเวอร์ Express
- `config/` : เก็บไฟล์ตั้งค่าการเชื่อมต่อฐานข้อมูล (`db.js`) และการยืนยันตัวตน (`passport.js`)
- `fonts/` : ฟอนต์ภาษาไทย (THSarabunNew.ttf) สำหรับฝังในไฟล์ PDF
- `models/` : โมเดลของ MongoDB (Mongoose) เช่น AddSeatRequest, GeneralRequest, OpenCourseRequest, User, subject
- `routes/` : Routing หลักของ API เช่น AddSeatRequestapi.js, GeneralRequestapi.js, OpenCourseRequest.js, api.js
- `templates/` : ไฟล์ PDF ต้นฉบับสำหรับสร้างเอกสารคำร้อง

---

## การติดตั้งและใช้งาน

### 1. ติดตั้ง Dependencies

```sh
npm install
```

### 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` แล้วกำหนดค่าต่อไปนี้ เช่น

```
MONGO_URI=your_mongodb_connection_string
SESSION_SECRET=your_secret_key
```

### 3. รันเซิร์ฟเวอร์

#### สำหรับพัฒนา (Dev)

```sh
npm run dev
```
หรือถ้าใช้ Docker

```sh
docker build -t swe-backend .
docker run -p 3000:3000 --env-file .env swe-backend
```

#### สำหรับ Production

```sh
npm start
```

### 4. พอร์ตที่ใช้

- ค่าเริ่มต้น: `3000`

---

## ฟีเจอร์หลัก

- ระบบยืนยันตัวตนและจัดการ session
- จัดการผู้ใช้ (Admin, Student, Advisor, Head)
- ยื่นคำร้อง 3 ประเภท: คำร้องทั่วไป, ขอเพิ่มที่นั่ง, ขอเปิดรายวิชานอกแผน
- ระบบอนุมัติ/ปฏิเสธคำร้องตามลำดับขั้น
- สร้างและดาวน์โหลดไฟล์ PDF คำร้อง
- สถิติและ Dashboard สำหรับผู้ดูแลระบบ
- รองรับการเชื่อมต่อกับ Frontend ผ่าน REST API

---

## API หลัก

- `/api/generalrequests` : จัดการคำร้องทั่วไป
- `/api/addseatrequests` : จัดการคำร้องขอเพิ่มที่นั่ง
- `/api/opencourserequests` : จัดการคำร้องขอเปิดรายวิชานอกแผน
- `/api/subjects` : จัดการรายวิชา
- `/api/users` : จัดการผู้ใช้
- `/api/dashboard` : ข้อมูลสถิติ

---

## หมายเหตุ

- ต้องมี MongoDB สำหรับเก็บข้อมูล
- ฟอนต์และไฟล์ PDF Template ต้องอยู่ในโฟลเดอร์ที่กำหนด
- สามารถปรับแต่งสิทธิ์และ role ได้ในไฟล์ model และ route

---

## การพัฒนาเพิ่มเติม

- เพิ่ม validation, logging, และ error handling ตามความเหมาะสม
- สามารถเพิ่ม API หรือโมเดลใหม่ได้ตามความต้องการ

---

## ผู้พัฒนา

- มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น
