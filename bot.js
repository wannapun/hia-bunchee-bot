// bot.js — intent parsing + category detection (Node.js)
// Mirrors the prototype's logic for real LINE deployment.

const CATEGORIES = {
  อาหาร:   { color: '#FF8A3D', icon: '🍜', keywords: ['กาแฟ','ข้าว','ก๋วยเตี๋ยว','กับข้าว','อาหาร','นม','ขนม','น้ำ','เบียร์','ส้มตำ','หมูกระทะ','ชาบู','pizza','starbucks','amazon','7-11','เซเว่น'] },
  เดินทาง: { color: '#3D8BFD', icon: '🚗', keywords: ['น้ำมัน','แท็กซี่','taxi','grab','bts','mrt','รถไฟฟ้า','มอไซค์','วินมอเตอร์ไซค์','ค่ารถ','ทางด่วน'] },
  ช้อปปิ้ง: { color: '#E5499A', icon: '🛍️', keywords: ['shopee','lazada','เสื้อ','รองเท้า','กระเป๋า','เครื่องสำอาง','lipstick','ของฝาก'] },
  บิล:     { color: '#7B61FF', icon: '📄', keywords: ['ค่าไฟ','ค่าน้ำ','ค่าเน็ต','ค่าโทรศัพท์','ค่าเช่า','ผ่อน','true','ais','dtac'] },
  บันเทิง: { color: '#FF5C5C', icon: '🎬', keywords: ['netflix','หนัง','เกม','spotify','youtube','คอนเสิร์ต','pub','คาราโอเกะ'] },
  สุขภาพ:  { color: '#1AB286', icon: '💊', keywords: ['ยา','หมอ','โรงพยาบาล','คลินิก','ฟิตเนส','gym','วิตามิน'] },
  อื่นๆ:    { color: '#9AA5B1', icon: '📦', keywords: [] },
};

const INCOME_KEYWORDS = ['เงินเดือน','รับ','ขาย','โบนัส','ฟรีแลนซ์','รายได้','salary','ได้รับ','โอนเข้า'];

const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function categorize(text) {
  const t = text.toLowerCase();
  for (const [name, def] of Object.entries(CATEGORIES)) {
    if (def.keywords.some(k => t.includes(k.toLowerCase()))) return name;
  }
  return 'อื่นๆ';
}

function parseExpense(text) {
  const t = text.trim();
  const m = t.match(/(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/);
  if (!m) return null;
  const amount = parseFloat(m[0].replace(/,/g, ''));
  if (amount <= 0 || amount > 10000000) return null;
  const label = t.replace(m[0], '').replace(/บาท|฿/gi, '').trim() || 'รายการ';
  const isIncome = INCOME_KEYWORDS.some(k => t.toLowerCase().includes(k));
  return {
    type: isIncome ? 'income' : 'expense',
    amount,
    label,
    category: isIncome ? 'รายรับ' : categorize(t),
  };
}

function parseRange(text) {
  const t = text.toLowerCase();
  const m = t.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)?/);
  if (m) {
    const monthStr = m[3] || TH_MONTHS[new Date().getMonth()];
    let monthIdx = TH_MONTHS.indexOf(monthStr);
    if (monthIdx < 0) monthIdx = new Date().getMonth();
    return { from: parseInt(m[1]), to: parseInt(m[2]), monthIdx, label: `${m[1]}-${m[2]} ${TH_MONTHS[monthIdx]}` };
  }
  if (t.includes('สัปดาห์') || t.includes('อาทิตย์')) return { range: 'week', label: 'สัปดาห์นี้' };
  if (t.includes('เดือนนี้') || t.includes('เดือน')) return { range: 'month', label: 'เดือนนี้' };
  if (t.includes('วันนี้')) return { range: 'today', label: 'วันนี้' };
  if (t.includes('เมื่อวาน')) return { range: 'yesterday', label: 'เมื่อวาน' };
  return null;
}

function intentOf(text) {
  const t = text.toLowerCase().trim();
  if (/^(สวัสดี|hi|hello|หวัดดี|เฮีย|ดีจ้า)/.test(t)) return 'greet';
  if (/(สรุป|ดูยอด|ยอด|รายงาน|report)/.test(t)) return 'summary';
  if (/(ล่าสุด|รายการล่าสุด)/.test(t)) return 'recent';
  if (/(^ลบ|undo|ยกเลิก)/.test(t)) return 'undo';
  if (/(งบ|budget|ตั้งงบ)/.test(t)) return 'budget';
  if (/(ช่วย|help|คำสั่ง|ทำอะไรได้)/.test(t)) return 'help';
  if (/(ขอบคุณ|thanks|thank)/.test(t)) return 'thanks';
  if (parseExpense(t)) return 'log';
  return 'unknown';
}

function summarize(entries, filter) {
  const now = new Date();
  const day = now.getDate();
  let items = entries.slice();
  if (filter.range === 'today')      items = items.filter(e => sameDay(e.date, now));
  else if (filter.range === 'yesterday') {
    const y = new Date(now); y.setDate(day - 1);
    items = items.filter(e => sameDay(e.date, y));
  }
  else if (filter.range === 'week')   items = items.filter(e => daysAgo(e.date) <= 6);
  else if (filter.range === 'month')  items = items.filter(e => sameMonth(e.date, now));
  else if (filter.from && filter.to)  items = items.filter(e => {
    const d = new Date(e.date);
    return d.getDate() >= filter.from && d.getDate() <= filter.to && d.getMonth() === filter.monthIdx;
  });

  const expense = items.filter(e => e.type === 'expense');
  const income  = items.filter(e => e.type === 'income');
  const totalE = expense.reduce((s,e) => s + e.amount, 0);
  const totalI = income.reduce((s,e) => s + e.amount, 0);
  const byCat = {};
  for (const e of expense) {
    if (!byCat[e.category]) byCat[e.category] = { total: 0, count: 0 };
    byCat[e.category].total += e.amount;
    byCat[e.category].count += 1;
  }
  return { items, expense, income, totalE, totalI, byCat };
}

function sameDay(a, b) { const d = new Date(a); return d.toDateString() === b.toDateString(); }
function sameMonth(a, b) { const d = new Date(a); return d.getMonth() === b.getMonth() && d.getFullYear() === b.getFullYear(); }
function daysAgo(a) { const ms = Date.now() - new Date(a).getTime(); return Math.floor(ms / 86400000); }

function fmtBaht(n) { return n.toLocaleString('th-TH', { maximumFractionDigits: 0 }); }

// ── Persona ────────────────────────────────────────────────
function hiaSays(key, mode, p = {}) {
  const M = {
    confirm: {
      ใจดี: 'รับทราบจ้าน้อง บันทึกให้แล้ว',
      ดุ:    'จดให้แล้วนะ ระวังกระเป๋าด้วย',
      ขำๆ:   'เฮียจดให้เร็วกว่าแฟนเก่าบล็อค',
    },
    income: {
      ใจดี: 'เยี่ยมเลยน้อง! เงินเข้าแล้ว 💰 อย่าลืมแบ่งเก็บนะ',
      ดุ:    'เงินเข้าแล้ว — รีบจัดสรรเลย อย่าใช้มั่ว',
      ขำๆ:   'อะอ้าว! เศรษฐีเลยน้อง พรุ่งนี้เลี้ยงเฮียมั้ย?',
    },
    greet: {
      ใจดี: 'สวัสดีน้อง! เฮียพร้อมช่วยจดบัญชีแล้ว ✨ พิมพ์เช่น "กาแฟ 60" ได้เลย',
      ดุ:    'เออ มา จะใช้เงินไม่ระวังอีกแล้วใช่มั้ย — พิมพ์รายการมา',
      ขำๆ:   'ไง น้อง วันนี้กระเป๋าจะหนักหรือเบา? พิมพ์รายการได้เลย',
    },
    undone: {
      ใจดี: 'ลบให้แล้วน้อง ไม่ต้องห่วง',
      ดุ:    'ลบให้ แต่ครั้งหน้าพิมพ์ให้ดีๆ',
      ขำๆ:   'เอ้า ลบทิ้ง! เหมือนเฮียลบเบอร์อดีต',
    },
    overBudget: {
      ใจดี: `น้องๆ ใช้เกินงบหมวด ${p.cat} แล้วน้า เฮียเตือนนะ`,
      ดุ:    `เกินงบ ${p.cat} แล้ว! เลิกใช้ได้แล้วน้อง`,
      ขำๆ:   `งบ ${p.cat} ทะลุแล้ว — เฮียก็เคยทะลุ แต่เป็นกางเกง`,
    },
    nearBudget: {
      ใจดี: `ใกล้เต็มงบ ${p.cat} แล้วน้อง เหลือ ฿${fmtBaht(p.left)}`,
      ดุ:    `${p.cat} เหลือ ฿${fmtBaht(p.left)} — ระวังด้วย!`,
      ขำๆ:   `งบ ${p.cat} จะหมดละ ฿${fmtBaht(p.left)} เอง รัดเข็มขัดไว้`,
    },
    unknown: {
      ใจดี: 'เฮียไม่ค่อยเข้าใจน้อง ลองพิมพ์ "กาแฟ 60" หรือ "สรุปวันนี้" ดู',
      ดุ:    'พิมพ์อะไรไม่รู้เรื่อง — พิมพ์ "ช่วย" สิ',
      ขำๆ:   'งงตึ้บ เหมือนตอนเฮียเรียนเลข ลองใหม่นะน้อง',
    },
    thanks: {
      ใจดี: 'ยินดีน้อง เฮียอยู่ตรงนี้เสมอ',
      ดุ:    'เอ้อ ไม่เป็นไร — แต่ออมเงินด้วย',
      ขำๆ:   'ขอบคุณเฮียได้ แต่เลี้ยงข้าวเฮียดีกว่า 555',
    },
    help: {
      ใจดี: '📝 พิมพ์ "กาแฟ 60" → บันทึกรายจ่าย\n💰 พิมพ์ "เงินเดือน 28000" → บันทึกรายรับ\n📊 พิมพ์ "สรุปวันนี้" หรือ "สรุป 1-15 พ.ค."\n🎯 พิมพ์ "ตั้งงบ 4000 อาหาร"\n⏮ พิมพ์ "ล่าสุด" หรือ "ลบ"',
    },
  };
  return (M[key] && (M[key][mode] || M[key]['ใจดี'])) || '';
}

const DEFAULT_BUDGETS = {
  อาหาร: 4000, เดินทาง: 2500, ช้อปปิ้ง: 2000,
  บิล: 3000, บันเทิง: 1000, สุขภาพ: 1500,
};

module.exports = {
  CATEGORIES, parseExpense, parseRange, intentOf,
  summarize, fmtBaht, hiaSays, DEFAULT_BUDGETS, TH_MONTHS,
};
