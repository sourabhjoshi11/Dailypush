-- Migration: create timesheet_templates table

-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;

-- Migration: create timesheet_templates table

create table if not exists timesheet_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  file_data bytea not null,
  date_header_row int not null,
  task_row int not null,
  uploaded_at timestamp default now()
);

alter table timesheet_templates enable row level security;
drop policy if exists "allow all" on timesheet_templates;
create policy "allow all" on timesheet_templates for all using (true) with check (true);
