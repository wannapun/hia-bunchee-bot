// supabase/functions/line-webhook/index.ts
// เฮียบัญชี Bot — LINE Messaging API webhook handler
// รับข้อความจาก LINE → parse → บันทึก/ตอบ → ถ้าเป็นคำถามวิเคราะห์ ส่งให้ Gemini

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

// ─── ENV ─────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")!;
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET")!;

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const genai = new GoogleGenerativeAI(GEMINI_API_KEY);

// ─── หมวดหมู่ (จาก bot-logic.js) ────────────────────────────
const CATEGORIES: Record<string, string[]> = {
  "อาหาร": ["กาแฟ", "ข้าว", "ก๋วยเตี๋ยว", "อาหาร", "นม", "ขนม", "น้ำ", "ส้มตำ", "หมูกระทะ", "ชาบู", "starbucks", "amazon", "7-11", "เซเว่น"],
  "เดินทาง": ["น้ำมัน", "แท็กซี่", "taxi", "grab", "bts", "mrt", "รถไฟฟ้า", "มอไซค์", "ค่ารถ", "ทางด่วน"],
  "ช้อปปิ้ง": ["shopee", "lazada", "เสื้อ", "รองเท้า", "กระเป๋า", "เครื่องสำอาง"],
  "บิล": ["ค่าไฟ", "ค่าน้ำ", "ค่าเน็ต", "ค่าโทรศัพท์", "ค่าเช่า", "ผ่อน", "true", "ais", "dtac"],
  "บันเทิง": ["netflix", "หนัง", "เกม", "spotify", "คอนเสิร์ต"],
  "สุขภาพ": ["ยา", "หมอ", "โรงพยาบาล", "คลินิก", "gym", "วิตามิน"],
};
const INCOME_KEYWORDS = ["เงินเดือน", "รับ", "โบนัส", "ฟรีแลนซ์", "รายได้", "salary"];

function categorize(text: string): string {
  const t = text.toLowerCase();
  for (const [name, keys] of Object.entries(CATEGORIES)) {
    if (keys.some(k => t.includes(k.toLowerCase()))) return name;
  }
  return "อื่นๆ";
}

function parseExpense(text: string) {
  const m = text.match(/(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/);
  if (!m) return null;
  const amount = parseFloat(m[0].replace(/,/g, ""));
  if (amount <= 0 || amount > 10_000_000) return null;
  const label = text.replace(m[0], "").replace(/บาท|฿/gi, "").trim() || "รายการ";
  const isIncome = INCOME_KEYWORDS.some(k => text.toLowerCase().includes(k));
  return {
    type: isIncome ? "income" : "expense",
    amount,
    label,
    category: isIncome ? "รายรับ" : categorize(text),
  };
}

function isAnalyticQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return /(เท่าไหร่|เท่าไร|กี่บาท|กี่ครั้ง|กี่รายการ|ทำไม|วิเคราะห์|แนะนำ|ออม|ประหยัด|เก็บเงิน|รวมเป็น|มากที่สุด|น้อยที่สุด|เปรียบเทียบ|เฉลี่ย)/.test(t);
}

// ─── LINE API ────────────────────────────────────────────────
async function replyLine(replyToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
  if (!res.ok) console.error("LINE reply error:", await res.text());
}

// ─── Gemini ──────────────────────────────────────────────────
async function askGemini(question: string, entries: any[]) {
  const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });

  const byCat: Record<string, { total: number; count: number }> = {};
  let totalExp = 0, totalInc = 0;
  for (const e of entries) {
    if (e.type === "expense") {
      totalExp += Number(e.amount);
      if (!byCat[e.category]) byCat[e.category] = { total: 0, count: 0 };
      byCat[e.category].total += Number(e.amount);
      byCat[e.category].count++;
    } else {
      totalInc += Number(e.amount);
    }
  }

  const breakdown = Object.entries(byCat)
    .map(([c, i]) => `  • ${c}: ฿${i.total.toLocaleString()} (${i.count} รายการ)`)
    .join("\n");

  const list = entries.slice(0, 30).map(e => {
    const sign = e.type === "expense" ? "-" : "+";
    const d = new Date(e.occurred_at);
    return `${d.getDate()}/${d.getMonth() + 1} ${sign}฿${e.amount} ${e.label} [${e.category}]`;
  }).join("\n");

  const prompt = `คุณคือ "เฮียบัญชี" บอท LINE จดบัญชี บุคลิกขำๆ มีมุก เรียกผู้ใช้ว่า "น้อง" เรียกตัวเองว่า "เฮีย" ลงท้ายด้วย 555 บ้าง

รายรับเดือนนี้: ฿${totalInc.toLocaleString()}
รายจ่ายเดือนนี้: ฿${totalExp.toLocaleString()}
คงเหลือ: ฿${(totalInc - totalExp).toLocaleString()}

ยอดแยกหมวด:
${breakdown}

รายการล่าสุด:
${list}

น้องถาม: "${question}"

ตอบเป็นภาษาไทย 1-3 ประโยค ใส่ตัวเลขจริง ใส่ emoji 1 ตัว อย่าแต่งตัวเลข ใช้บุคลิกขำๆ ตอบเลยไม่ต้องขึ้นต้น`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("Gemini error:", err);
    return "อ้าว สมองเฮียค้าง ลองใหม่ทีน้อง 555";
  }
}

// ─── Verify LINE signature ───────────────────────────────────
async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!signature) return false;
  const hash = hmac("sha256", LINE_CHANNEL_SECRET, body, "utf8", "base64");
  return hash === signature;
}

// ─── Main handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!await verifySignature(rawBody, signature)) {
    console.warn("Invalid LINE signature");
    return new Response("Invalid signature", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  for (const event of body.events ?? []) {
    if (event.type !== "message" || event.message.type !== "text") continue;

    const userId = event.source.userId;
    const text = event.message.text.trim();

    // upsert user
    await supa.from("users").upsert({ line_user_id: userId });

    // ดึงรายการเดือนนี้
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const { data: entries } = await supa
      .from("entries")
      .select("*")
      .eq("line_user_id", userId)
      .gte("occurred_at", firstOfMonth.toISOString())
      .order("occurred_at", { ascending: false });

    let replyText: string;

    // เป็นคำถามวิเคราะห์ → ส่งให้ Gemini
    if (isAnalyticQuestion(text)) {
      replyText = await askGemini(text, entries ?? []);
    }
    // มีตัวเลข → บันทึก
    else {
      const parsed = parseExpense(text);
      if (parsed) {
        await supa.from("entries").insert({
          line_user_id: userId,
          type: parsed.type,
          amount: parsed.amount,
          label: parsed.label,
          category: parsed.category,
          raw_text: text,
        });
        const icon = parsed.type === "income" ? "💰" : "📝";
        replyText = parsed.type === "income"
          ? `${icon} อะอ้าว! เศรษฐีเลยน้อง +฿${parsed.amount.toLocaleString()} (${parsed.label}) 555`
          : `${icon} จดให้แล้ว ${parsed.label} ฿${parsed.amount.toLocaleString()} [${parsed.category}] 555`;
      } else if (/(สวัสดี|hi|hello|หวัดดี)/i.test(text)) {
        replyText = "ไง น้อง วันนี้กระเป๋าจะหนักหรือเบา? 555";
      } else if (/(ช่วย|help|คำสั่ง)/i.test(text)) {
        replyText = `เฮียทำได้:
📝 พิมพ์ "กาแฟ 60" → บันทึก
💰 พิมพ์ "เงินเดือน 28000" → รายรับ
🤖 ถาม "เดือนนี้ค่าอาหารเท่าไหร่"
🤖 ถาม "แนะนำวิธีประหยัด"`;
      } else {
        replyText = "งงตึ้บ เหมือนตอนเฮียเรียนเลข ลองใหม่นะน้อง 555";
      }
    }

    await replyLine(event.replyToken, replyText);
  }

  return new Response("OK");
});
