-- ============================================================
-- AutoSched initial schema
-- Run this in your Supabase project → SQL Editor
-- ============================================================

-- ──────────────────────────────
-- PROFILES
-- ──────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);


-- ──────────────────────────────
-- TASKS
-- ──────────────────────────────
create table if not exists tasks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  title                 text not null,
  description           text,
  task_type             text not null default 'flexible'
                          check (task_type in ('flexible','anchor','fixed')),
  total_duration        integer not null default 60,   -- minutes
  priority              integer not null default 3
                          check (priority between 1 and 5),
  deadline              date,
  energy_intensity      text not null default 'moderate'
                          check (energy_intensity in ('deep','moderate','light')),
  scheduling_mode       text not null default 'flexible'
                          check (scheduling_mode in ('flexible','anchor','fixed')),
  window_start          text,                           -- HH:MM
  window_end            text,                           -- HH:MM
  start_datetime        timestamptz,
  end_datetime          timestamptz,
  execution_style       text not null default 'single'
                          check (execution_style in ('single','split','auto_chunk')),
  is_recurring          boolean not null default false,
  recurrence_pattern    text
                          check (recurrence_pattern in ('daily','weekdays','weekly','custom')),
  recurrence_interval   integer not null default 1,
  recurrence_end        date,
  status                text not null default 'active'
                          check (status in ('active','completed','paused')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "Users can view own tasks"
  on tasks for select using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on tasks for insert with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on tasks for update using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on tasks for delete using (auth.uid() = user_id);


-- ──────────────────────────────
-- SCHEDULED BLOCKS
-- ──────────────────────────────
create table if not exists scheduled_blocks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  task_id       uuid references tasks(id) on delete cascade,
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  source_type   text not null default 'engine'
                  check (source_type in ('engine','manual','anchor','fixed')),
  is_locked     boolean not null default false,
  block_type    text not null default 'focus'
                  check (block_type in ('focus','break')),
  instance_date date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table scheduled_blocks enable row level security;

create policy "Users can view own blocks"
  on scheduled_blocks for select using (auth.uid() = user_id);

create policy "Users can insert own blocks"
  on scheduled_blocks for insert with check (auth.uid() = user_id);

create policy "Users can update own blocks"
  on scheduled_blocks for update using (auth.uid() = user_id);

create policy "Users can delete own blocks"
  on scheduled_blocks for delete using (auth.uid() = user_id);


-- ──────────────────────────────
-- RECURRING ANCHOR RULES
-- ──────────────────────────────
create table if not exists recurring_anchor_rules (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  start_time       text not null,   -- HH:MM
  end_time         text not null,   -- HH:MM
  start_date       date,
  end_date         date,
  recurrence_rule  text not null,   -- 'daily' | 'weekdays' | 'weekly' | rrule string
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table recurring_anchor_rules enable row level security;

create policy "Users can view own anchor rules"
  on recurring_anchor_rules for select using (auth.uid() = user_id);

create policy "Users can insert own anchor rules"
  on recurring_anchor_rules for insert with check (auth.uid() = user_id);

create policy "Users can update own anchor rules"
  on recurring_anchor_rules for update using (auth.uid() = user_id);

create policy "Users can delete own anchor rules"
  on recurring_anchor_rules for delete using (auth.uid() = user_id);


-- ──────────────────────────────
-- USER SETTINGS
-- ──────────────────────────────
create table if not exists user_settings (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users(id) on delete cascade,
  timezone                 text not null default 'UTC',
  working_hours_start      text not null default '08:00',
  working_hours_end        text not null default '18:00',
  deep_window_start        text not null default '08:00',
  deep_window_end          text not null default '12:00',
  buffer_time              integer not null default 10,
  max_deep_hours_per_day   integer not null default 4,
  max_total_hours_per_day  integer not null default 8,
  min_chunk_size           integer not null default 25,
  max_chunk_size           integer not null default 120,
  scheduling_preferences   jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "Users can view own settings"
  on user_settings for select using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on user_settings for insert with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update using (auth.uid() = user_id);


-- ──────────────────────────────
-- AUTO-UPDATE updated_at
-- ──────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at_column();

create trigger scheduled_blocks_updated_at
  before update on scheduled_blocks
  for each row execute function update_updated_at_column();

create trigger recurring_anchor_rules_updated_at
  before update on recurring_anchor_rules
  for each row execute function update_updated_at_column();

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at_column();
