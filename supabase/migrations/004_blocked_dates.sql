create table if not exists blocked_dates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  room_type_id uuid references room_types(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz default now()
);

create index if not exists idx_blocked_dates_tenant on blocked_dates(tenant_id);
create index if not exists idx_blocked_dates_dates on blocked_dates(tenant_id, start_date, end_date);
