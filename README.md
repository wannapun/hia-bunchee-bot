# เฮียบัญชี Bot 🤖💚

LINE bot จดบัญชี + วิเคราะห์ด้วย Gemini AI — deploy บน Supabase Edge Functions

## Stack
- **LINE Messaging API** — chat interface
- **Supabase** — Postgres DB + Edge Functions (Deno runtime)
- **Gemini 2.0 Flash** — AI วิเคราะห์คำถามภาษาไทย
- **GitHub Actions** — auto-deploy ตอน push

## โครงสร้าง
```
hia-bunchee-bot/
├── .github/workflows/deploy.yml   ← CI/CD auto deploy
├── supabase/
│   ├── config.toml                ← Supabase project config
│   ├── migrations/001_init.sql    ← Database schema
│   └── functions/line-webhook/
│       └── index.ts               ← Edge Function (รับ LINE webhook)
├── .env.example                   ← ตัวอย่าง secrets
├── .gitignore
└── README.md
```

## Setup ครั้งแรก

### 1. Clone + Install Supabase CLI
```bash
npm i -g supabase
git clone https://github.com/YOUR_USERNAME/hia-bunchee-bot.git
cd hia-bunchee-bot
```

### 2. สร้าง Supabase Project
- ไปที่ [supabase.com/dashboard](https://supabase.com/dashboard) → New Project
- Region: `Southeast Asia (Singapore)`
- จด **Reference ID** (อยู่ที่ Settings → General)

### 3. Link + Run Migration
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push    # รัน migrations/001_init.sql
```

### 4. ใส่ Secrets
copy `.env.example` → `.env`, แก้ค่าจริง, แล้ว:
```bash
supabase secrets set --env-file .env
```

หรือใส่ทีละตัว:
```bash
supabase secrets set GEMINI_API_KEY=AIza...
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=...
supabase secrets set LINE_CHANNEL_SECRET=...
```

### 5. Deploy Function
```bash
supabase functions deploy line-webhook --no-verify-jwt
```

จะได้ URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-webhook`

### 6. ตั้ง LINE Webhook
- LINE Developers Console → channel → Messaging API
- Webhook URL: URL จากข้อ 5
- Use webhook: **ON**
- Auto-reply: **OFF**

### 7. (Optional) ตั้ง CI/CD
ใน GitHub repo → Settings → Secrets → Actions เพิ่ม:
- `SUPABASE_ACCESS_TOKEN` (จาก `supabase login`)
- `SUPABASE_PROJECT_REF`

หลังจากนี้ทุกครั้งที่ push branch `main`, function จะ deploy เอง

## ทดสอบ

เพิ่มบอทเป็นเพื่อนใน LINE แล้วลอง:

| พิมพ์ | บอททำอะไร |
|------|-----------|
| `กาแฟ 60` | บันทึก expense ฿60 หมวดอาหาร |
| `เงินเดือน 28000` | บันทึก income |
| `เดือนนี้ค่าอาหารเท่าไหร่` | Gemini วิเคราะห์ตอบ |
| `แนะนำวิธีประหยัด` | Gemini แนะนำ |
| `ช่วย` | แสดงคำสั่ง |

## ดู Logs
```bash
supabase functions logs line-webhook --tail
```

หรือ Dashboard → Edge Functions → line-webhook → Logs

## Troubleshooting

| ปัญหา | แก้ |
|------|-----|
| Webhook verify ไม่ผ่าน | เช็คว่า function deploy แล้ว, URL ถูก, return 200 |
| 401 Invalid signature | `LINE_CHANNEL_SECRET` ผิด — ตรวจที่ LINE console |
| Gemini error 429 | เกิน quota 1,500 req/วัน — รอวันถัดไป |
| Function timeout | logic ซับซ้อนเกิน — แยก async ด้วย `EdgeRuntime.waitUntil()` |

## License
MIT
