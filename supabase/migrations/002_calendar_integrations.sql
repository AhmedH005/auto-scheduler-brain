-- ============================================================
-- AutoSched / AXIS — Calendar Integrations schema
-- Run this in your Supabase project → SQL Editor
-- Requires: 001_initial_schema.sql already applied
-- ============================================================


-- ──────────────────────────────
-- CONNECTED CALENDAR ACCOUNTS
-- Stores one row per connected provider account per user.
-- Access tokens are NEVER stored here — they live in memory only.
-- ──────────────────────────────
create table if not exists connected_calendar_accounts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  provider               text not null check (provider in ('google', 'microsoft')),
  provider_account_id    text not null,
  provider_account_email text not null,
  display_name           text,
  avatar_url             text,
  is_connected           boolean not null default true,
  last_synced_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

alter table connected_calendar_accounts enable row level security;

create policy "Users can view own connected accounts"
  on connected_calendar_accounts for select using (auth.uid() = user_id);

create policy "Users can insert own connected accounts"
  on connected_calendar_accounts for insert with check (auth.uid() = user_id);

create policy "Users can update own connected accounts"
  on connected_calendar_accounts for update using (auth.uid() = user_id);

create policy "Users can delete own connected accounts"
  on connected_calendar_accounts for delete using (auth.uid() = user_id);

create trigger connected_calendar_accounts_updated_at
  before update on connected_calendar_accounts
  for each row execute function update_updated_at_column();


-- ──────────────────────────────
-- EXTERNAL CALENDARS
-- One row per calendar within a connected account.
-- is_enabled controls whether events from this calendar are used as busy time.
-- ──────────────────────────────
create table if not exists external_calendars (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null references connected_calendar_accounts(id) on delete cascade,
  provider_calendar_id text not null,
  name                 text not null,
  description          text,
  color                text,
  is_enabled           boolean not null default true,
  is_primary           boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (connected_account_id, provider_calendar_id)
);

alter table external_calendars enable row level security;

create policy "Users can view own external calendars"
  on external_calendars for select using (auth.uid() = user_id);

create policy "Users can insert own external calendars"
  on external_calendars for insert with check (auth.uid() = user_id);

create policy "Users can update own external calendars"
  on external_calendars for update using (auth.uid() = user_id);

create policy "Users can delete own external calendars"
  on external_calendars for delete using (auth.uid() = user_id);

create trigger external_calendars_updated_at
  before update on external_calendars
  for each row execute function update_updated_at_column();


-- ──────────────────────────────
-- EXTERNAL CALENDAR EVENTS
-- Imported events from connected provider calendars.
-- Deduplicated by (connected_account_id, provider_event_id).
-- status = 'cancelled' → event was deleted on the provider side.
-- All-day events are stored but excluded from scheduler blocking.
-- ──────────────────────────────
create table if not exists external_calendar_events (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null references connected_calendar_accounts(id) on delete cascade,
  external_calendar_id uuid not null references external_calendars(id) on delete cascade,
  provider_event_id    text not null,
  title                text not null,
  description          text,
  start_at             timestamptz not null,
  end_at               timestamptz not null,
  is_all_day           boolean not null default false,
  location             text,
  status               text not null default 'confirmed'
                         check (status in ('confirmed', 'tentative', 'cancelled')),
  last_synced_at       timestamptz not null default now(),
  raw_payload          jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (connected_account_id, provider_event_id)
);

alter table external_calendar_events enable row level security;

create policy "Users can view own external events"
  on external_calendar_events for select using (auth.uid() = user_id);

create policy "Users can insert own external events"
  on external_calendar_events for insert with check (auth.uid() = user_id);

create policy "Users can update own external events"
  on external_calendar_events for update using (auth.uid() = user_id);

create policy "Users can delete own external events"
  on external_calendar_events for delete using (auth.uid() = user_id);

create trigger external_calendar_events_updated_at
  before update on external_calendar_events
  for each row execute function update_updated_at_column();
