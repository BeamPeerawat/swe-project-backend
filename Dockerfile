# ใช้ Node.js เวอร์ชัน 16 เป็นฐาน
FROM node:16

# กำหนด working directory ใน container
WORKDIR /app

# คัดลอกไฟล์ package.json และ package-lock.json
COPY package*.json ./

# ติดตั้ง dependencies และ nodemon สำหรับ development
RUN npm install
RUN npm install -g nodemon

# คัดลอกไฟล์ทั้งหมดในโปรเจค
COPY . .

# เปิด port 3000
EXPOSE 3000

# รันแอพพลิเคชันด้วย nodemon เพื่อให้รีสตาร์ทอัตโนมัติเมื่อมีการเปลี่ยนแปลงโค้ด
CMD ["nodemon", "server.js"]