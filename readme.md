# 📦 Project Analyzer

เครื่องมือวิเคราะวิเครห์โค๊ดโปรเจกต์ React Native หรือ Node.js พร้อมสร้างรายงาน `.xlsx` และ `.json` โดยไม่ต้องติดตั้ง Node.js หรือ npm บนเครื่องปลายทาง

## ✅ Features

* นับจำนวน Function / Class Components
* นับบรรทัดโค้ด (Lines of Code)
* นับจำนวนไฟล์ทั้งหมด
* แสดงจำนวน dependencies / devDependencies
* ตรวจจับ Parse Errors
* สร้างไฟล์รายงาน `.xlsx` และ `.json`
* ใช้งานได้บน macOS และ Windows (binary จาก `pkg`)

---

## 🛠 วิธี build เป็น binary ด้วย pkg

ติดตั้ง `pkg` (ถ้ายังไม่มี):

```bash
npm install -g pkg
```

จากนั้นสั่ง build:

```bash
pkg . \
  --targets node18-macos-x64,node18-win-x64 \
  --output project-analyzer
```

จะได้ไฟล์:

* `project-analyzer` (macOS)
* `project-analyzer.exe` (Windows)

---

## ▶️ วิธีใช้งาน

> ⚠️ ต้องระบุ path โปรเจกต์ด้วย `--path=...`

### macOS:

```bash
./project-analyzer --path=/Users/yourname/Projects/my-react-native-app
```

### Windows (PowerShell / CMD):

```powershell
project-analyzer.exe --path="D:\Projects\MyApp"
```

---

## 📂 Output Files

เมื่อสั่งรันสำเร็จจะได้ไฟล์:

* `project_analysis.json` – รายงานแบบ machine-readable
* `project_analysis.xlsx` – รายงานแบบอ่านง่ายด้วย Excel

---

## 📝 หมายเทส

* จะไม่วิเคราะไฟล์ภายใต้ `node_modules`, `build`, `dist`, `Pods`, `.gradle`, `android/app/build`
* ข้ามไฟล์รูปภาพ / ฟอนต์ เช่น `.png`, `.ttf`, `.wav`
* สามารถรันได้ทั้งโฟลเดอร์ที่เป็น React Native หรือ Node.js project ที่มี `package.json`

---

## 💡 ตัวอย่างคำสั่งรวดเร็ว

```bash
./project-analyzer --path=$(pwd)
```

หรือบน Windows:

```powershell
project-analyzer.exe --path="%cd%"
```

---

## 📌 License

MIT © Arthit75420