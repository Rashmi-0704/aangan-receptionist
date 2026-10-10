-- Aangan Studio AI receptionist schema.
-- Run in the Neon console → SQL Editor. Safe to re-run.

-- One row per phone call. Every call is stored, qualified or not.
create table if not exists calls (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  external_call_id     text unique,           -- Vaani call id (idempotency on webhook retries)
  source               text not null default 'vaani',  -- vaani | mock | (later) whatsapp | web_form
  caller_name          text,
  phone                text,
  area                 text,
  company              text,
  space_type           text,
  size_sqft            integer,
  budget_range         text,
  timeline             text,
  transcript           text,
  summary              text,
  status               text not null default 'pending'
                       check (status in ('pending','qualified','unqualified','needs_review')),
  reason               text,
  reason_category      text,                  -- groups "top disqualification reasons"
  after_hours          boolean not null default false,
  answer_delay_sec     integer,               -- ring-to-answer, if the provider reports it
  call_duration_sec    integer,
  call_cost_inr        numeric(10,2) default 0,
  classifier_cost_inr  numeric(10,4) default 0,
  booking_link         text,
  booking_uid          text,
  assigned_designer    text,
  hubspot_id           text,
  email_sent_at        timestamptz,
  pipeline_errors      jsonb not null default '[]'::jsonb
);

create index if not exists calls_created_at_idx on calls (created_at desc);
create index if not exists calls_status_idx on calls (status);

-- Bookings made mid-call by the voice agent's tool calls (matched to a call by phone).
create table if not exists bookings (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  phone        text,
  external_call_id text,
  booking_uid  text,
  start_time   timestamptz,
  booking_link text,
  mock         boolean not null default false
);
create index if not exists bookings_phone_idx on bookings (phone, created_at desc);

-- Raw verified webhook payloads (Vaani doesn't document call.completed fields).
create table if not exists webhook_events (
  id          bigserial primary key,
  received_at timestamptz not null default now(),
  event_type  text,
  payload     jsonb not null
);

-- HubSpot mock: what would have been sent to HubSpot while no token is configured.
create table if not exists crm_mock (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  call_id     uuid references calls(id) on delete cascade,
  object_type text not null check (object_type in ('contact','deal')),
  payload     jsonb not null
);
