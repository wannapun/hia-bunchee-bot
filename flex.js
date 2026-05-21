// flex.js — LINE Flex Message JSON builders for เฮียบัญชี Bot

const { CATEGORIES, fmtBaht } = require('./bot');

function confirmCard(entry) {
  const c = CATEGORIES[entry.category] || CATEGORIES['อื่นๆ'];
  return {
    type: 'flex',
    altText: `บันทึก: ${entry.label} ฿${fmtBaht(entry.amount)}`,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'horizontal',
        backgroundColor: c.color, paddingAll: '14px',
        contents: [
          { type: 'text', text: 'บันทึกรายจ่าย', color: '#ffffff', size: 'sm', weight: 'bold', flex: 1 },
          { type: 'text', text: c.icon, color: '#ffffff', size: 'md', align: 'end' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        contents: [
          { type: 'text', text: entry.label, size: 'sm', color: '#4B5563' },
          { type: 'text', text: `฿${fmtBaht(entry.amount)}`, size: 'xxl', weight: 'bold', color: '#0F1419' },
          { type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md', contents: [
            { type: 'text', text: `หมวด · ${entry.category}`, size: 'xxs', color: '#94A3B8', flex: 1 },
            { type: 'text', text: thaiDate(entry.date), size: 'xxs', color: '#94A3B8', align: 'end' },
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'horizontal', spacing: 'none',
        contents: [
          { type: 'button', height: 'sm', style: 'link', color: '#4B5563',
            action: { type: 'postback', label: 'ยกเลิก', data: `action=undo&id=${entry.id}`, displayText: 'ลบ' }},
          { type: 'separator' },
          { type: 'button', height: 'sm', style: 'link', color: '#06C755',
            action: { type: 'postback', label: 'เปลี่ยนหมวด', data: `action=editCat&id=${entry.id}`, displayText: 'เปลี่ยนหมวด' }},
        ],
      },
    },
  };
}

function incomeCard(entry) {
  return {
    type: 'flex',
    altText: `รายรับ +฿${fmtBaht(entry.amount)}`,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '14px',
        backgroundColor: '#06C755',
        contents: [
          { type: 'text', text: 'รายรับเข้า', color: '#ffffff', size: 'xs' },
          { type: 'text', text: `+฿${fmtBaht(entry.amount)}`, color: '#ffffff', size: 'xxl', weight: 'bold' },
          { type: 'text', text: entry.label, color: '#ffffff', size: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'horizontal', paddingAll: '12px',
        contents: [
          { type: 'text', text: 'เก็บออม 20%', size: 'xs', color: '#94A3B8', flex: 1 },
          { type: 'text', text: `฿${fmtBaht(entry.amount * 0.2)}`, size: 'sm', color: '#06C755', weight: 'bold', align: 'end' },
        ],
      },
    },
  };
}

function summaryCard(title, subtitle, data) {
  const cats = Object.entries(data.byCat).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  const total = data.totalE || 1;
  return {
    type: 'flex',
    altText: `${title} ฿${fmtBaht(data.totalE)}`,
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '14px', backgroundColor: '#FAFBFC',
        contents: [
          { type: 'text', text: subtitle, size: 'xxs', color: '#94A3B8', weight: 'bold' },
          { type: 'text', text: title, size: 'lg', weight: 'bold', color: '#0F1419' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'md',
        contents: [
          { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { type: 'box', layout: 'vertical', flex: 1, backgroundColor: '#F0FDF4', paddingAll: '10px', cornerRadius: '8px', contents: [
              { type: 'text', text: 'รายรับ', size: 'xxs', color: '#16A34A' },
              { type: 'text', text: `+฿${fmtBaht(data.totalI)}`, size: 'md', weight: 'bold', color: '#15803D' },
            ]},
            { type: 'box', layout: 'vertical', flex: 1, backgroundColor: '#FEF2F2', paddingAll: '10px', cornerRadius: '8px', contents: [
              { type: 'text', text: 'รายจ่าย', size: 'xxs', color: '#DC2626' },
              { type: 'text', text: `-฿${fmtBaht(data.totalE)}`, size: 'md', weight: 'bold', color: '#B91C1C' },
            ]},
          ]},
          { type: 'separator', margin: 'sm' },
          ...cats.map(([name, v]) => {
            const c = CATEGORIES[name] || CATEGORIES['อื่นๆ'];
            const pct = Math.round((v.total / total) * 100);
            return {
              type: 'box', layout: 'vertical', spacing: 'xs',
              contents: [
                { type: 'box', layout: 'horizontal', contents: [
                  { type: 'text', text: `${c.icon} ${name}`, size: 'sm', flex: 5, color: '#0F1419' },
                  { type: 'text', text: `฿${fmtBaht(v.total)}`, size: 'sm', weight: 'bold', flex: 3, align: 'end', color: '#0F1419' },
                  { type: 'text', text: `${pct}%`, size: 'xs', color: '#94A3B8', flex: 2, align: 'end' },
                ]},
                { type: 'box', layout: 'vertical', height: '4px', backgroundColor: '#F1F5F9', cornerRadius: '2px',
                  contents: [{ type: 'box', layout: 'vertical', height: '4px', width: `${pct}%`, backgroundColor: c.color, cornerRadius: '2px', contents: [{ type: 'filler' }]}]},
              ],
            };
          }),
        ],
      },
      footer: {
        type: 'box', layout: 'horizontal',
        contents: [
          { type: 'button', height: 'sm', style: 'link',
            action: { type: 'message', label: 'ดูทั้งหมด', text: 'ล่าสุด' }},
        ],
      },
    },
  };
}

function budgetAlertCard({ cat, used, limit }) {
  const c = CATEGORIES[cat];
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const over = used > limit;
  return {
    type: 'flex',
    altText: `แจ้งเตือนงบ ${cat}`,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type: 'box', layout: 'horizontal', paddingAll: '12px',
        backgroundColor: over ? '#FEF2F2' : '#FEF8E7',
        contents: [
          { type: 'text', text: over ? '⚠️' : '⚡', size: 'lg', flex: 0 },
          { type: 'box', layout: 'vertical', flex: 1, contents: [
            { type: 'text', text: over ? 'เกินงบประมาณ' : 'ใกล้เต็มงบ', size: 'xs',
              color: over ? '#DC2626' : '#B45309', weight: 'bold' },
            { type: 'text', text: `หมวด ${cat} ${c.icon}`, size: 'sm', weight: 'bold' },
          ]},
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'md',
        contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: 'ใช้แล้ว', size: 'sm', color: '#4B5563', flex: 1 },
            { type: 'text', text: `฿${fmtBaht(used)} / ฿${fmtBaht(limit)}`, size: 'sm', weight: 'bold', align: 'end' },
          ]},
          { type: 'box', layout: 'vertical', height: '8px', backgroundColor: '#F1F5F9', cornerRadius: '4px',
            contents: [{ type: 'box', layout: 'vertical', height: '8px', width: `${pct}%`,
              backgroundColor: over ? '#DC2626' : c.color, cornerRadius: '4px',
              contents: [{ type: 'filler' }]}]},
        ],
      },
    },
  };
}

function recentListCard(entries) {
  return {
    type: 'flex',
    altText: 'รายการล่าสุด',
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [{ type: 'text', text: 'รายการล่าสุด', weight: 'bold', size: 'md' }],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '8px', spacing: 'sm',
        contents: entries.slice(0, 6).map((e, i) => {
          const c = CATEGORIES[e.category] || CATEGORIES['อื่นๆ'];
          return {
            type: 'box', layout: 'horizontal', paddingAll: '8px', spacing: 'sm',
            action: { type: 'postback', data: `action=delete&id=${e.id}`, displayText: `ลบ ${e.label}` },
            contents: [
              { type: 'text', text: c.icon, size: 'md', flex: 0 },
              { type: 'box', layout: 'vertical', flex: 6, contents: [
                { type: 'text', text: e.label, size: 'sm', weight: 'bold', wrap: false },
                { type: 'text', text: `${e.category} · ${thaiDate(e.date)}`, size: 'xxs', color: '#94A3B8' },
              ]},
              { type: 'text', text: `${e.type === 'income' ? '+' : '-'}฿${fmtBaht(e.amount)}`,
                size: 'sm', weight: 'bold', flex: 3, align: 'end',
                color: e.type === 'income' ? '#06C755' : '#0F1419' },
            ],
          };
        }),
      },
    },
  };
}

function thaiDate(d) {
  const D = new Date(d);
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${D.getDate()} ${months[D.getMonth()]} ${String(D.getHours()).padStart(2,'0')}:${String(D.getMinutes()).padStart(2,'0')}`;
}

module.exports = { confirmCard, incomeCard, summaryCard, budgetAlertCard, recentListCard };
