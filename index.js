// index.js — เฮียบัญชี Bot · LINE Messaging API webhook
//
// Flow:
//   LINE platform → POST /webhook → middleware verifies signature
//   → for each event, handleEvent() decides intent and replies
//
// Local: node index.js  (requires .env)
// Cloud: Render/Railway/Fly will auto-set PORT.

require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

const bot = require('./bot');
const flex = require('./flex');
const store = require('./storage');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.error('❌ Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET');
  process.exit(1);
}

const client = new line.Client(config);
const app = express();

// Health check
app.get('/', (_req, res) => res.send('เฮียบัญชี Bot is alive 👋'));

// Webhook
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all((req.body.events || []).map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🟢 เฮียบัญชี Bot listening on :${PORT}`));

// ── Event handler ─────────────────────────────────────────────
async function handleEvent(event) {
  const userId = event.source?.userId;
  if (!userId) return;

  if (event.type === 'follow') {
    return reply(event, [{ type: 'text', text: bot.hiaSays('greet', 'ใจดี') }]);
  }

  if (event.type === 'postback') {
    return handlePostback(event, userId);
  }

  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = event.message.text;
  const mode = await store.getPersonality(userId);

  // Personality switch shortcut
  if (/^โหมด\s*(ใจดี|ดุ|ขำๆ)/i.test(text)) {
    const newMode = text.match(/(ใจดี|ดุ|ขำๆ)/)[1];
    await store.setPersonality(userId, newMode);
    return reply(event, [{ type: 'text', text: `เปลี่ยนโทนเป็น "${newMode}" แล้วน้อง` }]);
  }

  const intent = bot.intentOf(text);
  const messages = await buildResponse(text, intent, userId, mode);
  return reply(event, messages.slice(0, 5)); // LINE limit: 5 messages per reply
}

async function buildResponse(text, intent, userId, mode) {
  if (intent === 'greet')   return [{ type: 'text', text: bot.hiaSays('greet', mode) }];
  if (intent === 'thanks')  return [{ type: 'text', text: bot.hiaSays('thanks', mode) }];
  if (intent === 'help')    return [{ type: 'text', text: bot.hiaSays('help', mode) }];

  if (intent === 'undo') {
    const last = await store.getLastEntry(userId);
    if (!last) return [{ type: 'text', text: 'ไม่มีอะไรให้ลบแล้วน้อง' }];
    await store.deleteEntry(userId, last.id);
    return [{ type: 'text', text: `${bot.hiaSays('undone', mode)} (${last.label} ฿${bot.fmtBaht(last.amount)})` }];
  }

  if (intent === 'recent') {
    const entries = await store.getEntries(userId, { limit: 6 });
    if (!entries.length) return [{ type: 'text', text: 'ยังไม่มีรายการเลยน้อง พิมพ์เช่น "กาแฟ 60" ดู' }];
    return [flex.recentListCard(entries)];
  }

  if (intent === 'summary') {
    const range = bot.parseRange(text) || { range: 'today', label: 'วันนี้' };
    const entries = await store.getEntries(userId);
    const data = bot.summarize(entries, range);
    return [
      flex.summaryCard(`สรุป${range.label}`, 'รายงานการใช้จ่าย', data),
      { type: 'text', text: `${range.label} จ่ายไป ฿${bot.fmtBaht(data.totalE)} จาก ${data.expense.length} รายการน้อง` },
    ];
  }

  if (intent === 'budget') {
    if (/ตั้งงบ/.test(text)) {
      // "ตั้งงบ 4000 อาหาร"
      const m = text.match(/ตั้งงบ\s*(\d+)\s*(\S+)?/);
      if (m) {
        const amt = parseInt(m[1]);
        const cat = m[2] || 'อาหาร';
        await store.setBudget(userId, cat, amt);
        return [{ type: 'text', text: `รับทราบ! ตั้งงบหมวด ${cat} ไว้ที่ ฿${bot.fmtBaht(amt)}/เดือน ✅` }];
      }
    }
    const budgets = { ...bot.DEFAULT_BUDGETS, ...(await store.getBudgets(userId)) };
    const entries = await store.getEntries(userId);
    const monthSum = bot.summarize(entries, { range: 'month' });
    const lines = Object.entries(budgets).map(([cat, lim]) => {
      const used = monthSum.byCat[cat]?.total || 0;
      const pct = Math.round((used / lim) * 100);
      return `${bot.CATEGORIES[cat]?.icon || ''} ${cat}: ฿${bot.fmtBaht(used)}/฿${bot.fmtBaht(lim)} (${pct}%)`;
    });
    return [{ type: 'text', text: `งบเดือนนี้:\n\n${lines.join('\n')}` }];
  }

  if (intent === 'log') {
    const parsed = bot.parseExpense(text);
    const entry = {
      type: parsed.type, amount: parsed.amount, label: parsed.label,
      category: parsed.category, date: new Date(),
    };
    const id = await store.addEntry(userId, entry);
    entry.id = id;

    const messages = [];
    if (parsed.type === 'income') {
      messages.push(flex.incomeCard(entry));
      messages.push({ type: 'text', text: bot.hiaSays('income', mode) });
    } else {
      messages.push(flex.confirmCard(entry));

      // Budget check
      const budgets = { ...bot.DEFAULT_BUDGETS, ...(await store.getBudgets(userId)) };
      const limit = budgets[parsed.category];
      if (limit) {
        const entries = await store.getEntries(userId);
        const monthSum = bot.summarize(entries, { range: 'month' });
        const used = monthSum.byCat[parsed.category]?.total || 0;
        if (used > limit) {
          messages.push(flex.budgetAlertCard({ cat: parsed.category, used, limit }));
          messages.push({ type: 'text', text: bot.hiaSays('overBudget', mode, { cat: parsed.category }) });
        } else if (used > limit * 0.85) {
          messages.push({ type: 'text', text: bot.hiaSays('nearBudget', mode, { cat: parsed.category, left: limit - used }) });
        } else {
          messages.push({ type: 'text', text: bot.hiaSays('confirm', mode) });
        }
      } else {
        messages.push({ type: 'text', text: bot.hiaSays('confirm', mode) });
      }
    }
    return messages;
  }

  // Unknown
  return [
    { type: 'text', text: bot.hiaSays('unknown', mode),
      quickReply: { items: [
        qrItem('📊 สรุปวันนี้', 'สรุปวันนี้'),
        qrItem('📋 ล่าสุด', 'ล่าสุด'),
        qrItem('🎯 งบ', 'งบ'),
        qrItem('💬 ช่วย', 'ช่วย'),
      ]}},
  ];
}

async function handlePostback(event, userId) {
  const params = new URLSearchParams(event.postback.data);
  const action = params.get('action');
  if (action === 'undo' || action === 'delete') {
    const id = params.get('id');
    if (id) await store.deleteEntry(userId, id);
    return reply(event, [{ type: 'text', text: 'ลบแล้วน้อง ✅' }]);
  }
  if (action === 'editCat') {
    return reply(event, [{ type: 'text', text: 'จะเปลี่ยนหมวดเป็นอะไร? พิมพ์ชื่อหมวด เช่น "อาหาร" หรือ "ช้อปปิ้ง"' }]);
  }
}

function qrItem(label, text) {
  return { type: 'action', action: { type: 'message', label, text } };
}

function reply(event, messages) {
  if (!messages || !messages.length) return;
  return client.replyMessage(event.replyToken, messages);
}
