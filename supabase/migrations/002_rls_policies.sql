-- Enable RLS on all tables
alter table tenants enable row level security;
alter table business_profiles enable row level security;
alter table schedule_rules enable row level security;
alter table schedule_overrides enable row level security;
alter table appointments enable row level security;
alter table conversations enable row level security;

-- Tenants: owner only
create policy "tenant_owner_all" on tenants
  for all using (owner_id = auth.uid());

-- Business profiles: via tenant ownership
create policy "business_profile_owner_all" on business_profiles
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );

-- Schedule rules: via tenant ownership
create policy "schedule_rules_owner_all" on schedule_rules
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );

-- Schedule overrides: via tenant ownership
create policy "schedule_overrides_owner_all" on schedule_overrides
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );

-- Appointments: via tenant ownership
create policy "appointments_owner_all" on appointments
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );

-- Conversations: via tenant ownership
create policy "conversations_owner_all" on conversations
  for all using (
    tenant_id in (select id from tenants where owner_id = auth.uid())
  );
