create table if not exists seasonal_pricing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  room_type_id uuid references room_types(id) on delete cascade not null,
  label text not null,
  start_date date not null,
  end_date date not null,
  price_per_night numeric(10,2) not null,
  created_at timestamptz default now()
);

create index if not exists idx_seasonal_pricing_tenant on seasonal_pricing(tenant_id);
create index if not exists idx_seasonal_pricing_room_type on seasonal_pricing(room_type_id);

alter table seasonal_pricing enable row level security;

create policy "Tenant members can manage seasonal pricing"
  on seasonal_pricing
  for all
  using (
    tenant_id in (
      select id from tenants where owner_id = auth.uid()
    )
  );
