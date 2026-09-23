-- 012_rls_missing_tables.sql
-- Fix for the Supabase advisor alert `rls_disabled_in_public` (19 Sep 2026).
--
-- Tables created outside this migration folder (room_types, reservations) and
-- blocked_dates (created in 004 without RLS) are reachable with the public anon
-- key, which ships in the browser bundle. Anyone with the project URL can read,
-- edit and delete them.
--
-- Safe to re-run. Enabling RLS does NOT affect the service-role client
-- (createServiceClient), which is what the Vapi voice agent, the public booking
-- flow, the widget and the cron jobs use. The dashboard routes use the
-- session-bound client and already filter by tenant_id, so the owner policies
-- below match exactly what the application code does.

-- 1. blocked_dates -----------------------------------------------------------
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocked_dates_owner_all" ON blocked_dates;
CREATE POLICY "blocked_dates_owner_all" ON blocked_dates
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

-- 2. room_types --------------------------------------------------------------
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_types_owner_all" ON room_types;
CREATE POLICY "room_types_owner_all" ON room_types
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

-- 3. reservations (guest names + phone numbers - the most sensitive table) ----
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reservations_owner_all" ON reservations;
CREATE POLICY "reservations_owner_all" ON reservations
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

-- 4. rooms (RLS exists only in the hotel-phase1 worktree migration; it may
--    never have been applied to production - this makes it certain) ----------
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rooms_owner_all" ON rooms;
DROP POLICY IF EXISTS "tenant_isolation" ON rooms;
CREATE POLICY "rooms_owner_all" ON rooms
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );

-- Verification: every row returned by this query is still exposed.
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false;
