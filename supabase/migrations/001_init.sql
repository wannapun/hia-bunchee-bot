-- supabase/migrations/001_init.sql
-- เฮียบัญชี Bot — Initial schema

-- ตารางผู้ใช้ (LINE user id เป็น key)
create table if not exists users (
  line_user_id text primary key,
  display_name text,
  personality text default 'ขำๆ',
  created_at timestamptz default now()
);

-- ตารางรายการรับ-จ่าย
create table if not exists entries (
  id bigserial primary key,
  line_user_id text references users(line_user_id) on delete cascade,
  type text check (type in ('income', 'expense')),
  amount numeric not null,
  label text not null,
  category text not null,
  occurred_at timestamptz default now(),
  raw_text text,
  created_at timestamptz default now()
);

-- index สำหรับ query เร็ว
create index if not exists idx_entries_user_date on entries(line_user_id, occurred_at desc);
create index if not exists idx_entries_category on entries(line_user_id, category);

-- ตารางงบประมาณรายหมวด
create table if not exists budgets (
  line_user_id text references users(line_user_id) on delete cascade,
  category text not null,
  monthly_limit numeric not null,
  primary key (line_user_id, category)
);

-- เปิด Row Level Security
alter table users enable row level security;
alter table entries enable row level security;
alter table budgets enable row level security;
