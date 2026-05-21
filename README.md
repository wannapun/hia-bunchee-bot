# เฮียบัญชี Bot — Server

LINE Messaging API webhook ที่ทำงานจริง พอร์ตจาก prototype มาเป็น Node.js + Express + Firestore

## รัน Local
```bash
cp .env.example .env
# เปิด .env แล้วเติม LINE token + Firebase service account
npm install
npm start
# ใช้ ngrok / cloudflared เปิด tunnel ไปที่ http://localhost:3000/webhook
```

## โครงสร้าง
```
index.js     ← Express webhook entry
bot.js       ← intent parsing + categorize + summarize
flex.js      ← Flex Message JSON builders
storage.js   ← Firestore wrapper (per-user entries/budgets/personality)
```

## คำสั่งที่บอทเข้าใจ
- `กาแฟ 60` / `ค่าน้ำมัน 500 บาท` → บันทึกรายจ่าย + จัดหมวดอัตโนมัติ
- `เงินเดือน 28000` / `รับ 5000` → บันทึกรายรับ
- `สรุปวันนี้` / `สรุป 1-15 พ.ค.` / `สรุปเดือนนี้` → ส่ง Flex card สรุป
- `ล่าสุด` → 6 รายการล่าสุด
- `ลบ` / `ยกเลิก` → ลบรายการล่าสุด
- `ตั้งงบ 4000 อาหาร` → ตั้งงบประมาณ
- `งบ` / `budget` → ดูงบทุกหมวด
- `โหมด ใจดี` / `โหมด ดุ` / `โหมด ขำๆ` → สลับบุคลิก
- `ช่วย` → คู่มือคำสั่ง

ดูคู่มือ deploy เต็มได้ที่ `วิธีใช้งานบอตจริง.html` ในโปรเจคหลัก
