-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tenants (businesses)
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  business_name text not null,
  slug text unique not null,
  phone text,
  address text,
  languages text[] default array['bg'],
  public_api_key uuid unique default uuid_generate_v4(),
  vapi_assistant_id text,
  vapi_phone_number text,
  subscription_status text default 'trial' check (subscription_status in ('trial', 'active', 'cancelled', 'past_due')),
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz default now() + interval '14 days',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Business profiles (AI configuration)
create table business_profiles (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null unique,
  services jsonb default '[]'::jsonb,
  faqs jsonb default '[]'::jsonb,
  booking_rules text default '',
  welcome_message_bg text default 'Здравейте! Как мога да ви помогна?',
  welcome_message_en text default 'Hello! How can I help you?',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Schedule rules (working hours per day of week)
create table schedule_rules (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_duration_min int not null default 30,
  break_start time,
  break_end time,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(tenant_id, day_of_week)
);

-- Schedule overrides (holidays, special days)
create table schedule_overrides (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  date date not null,
  override_type text not null check (override_type in ('closed', 'custom')),
  slots jsonb default '[]'::jsonb,
  note text,
  created_at timestamptz default now(),
  unique(tenant_id, date)
);

-- Appointments
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  patient_name text not null,
  patient_phone text not null,
  service text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text default 'confirmed' check (status in ('confirmed', 'cancelled', 'no_show', 'completed')),
  channel text not null check (channel in ('phone', 'chat', 'manual')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Conversations (call/chat logs)
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  channel text not null check (channel in ('phone', 'chat')),
  language text default 'bg',
  transcript jsonb default '[]'::jsonb,
  appointment_id uuid references appointments(id),
  duration_sec int,
  outcome text check (outcome in ('booked', 'answered', 'failed', 'transferred')),
  created_at timestamptz default now()
);

-- Indexes
create index idx_appointments_tenant_starts on appointments(tenant_id, starts_at);
create index idx_appointments_status on appointments(tenant_id, status);
create index idx_conversations_tenant on conversations(tenant_id, created_at desc);
create index idx_schedule_rules_tenant on schedule_rules(tenant_id);
