-- TEMPLATE - copy this into every migration that CREATES a table.
-- Not a migration itself. Lives outside migrations/ so it never runs.
--
-- Why: from 30 Oct 2026 Supabase stops auto-granting Data API access to new
-- tables in `public`. A table created without grants is invisible to
-- supabase-js / PostgREST and every call fails with "permission denied".
-- Applies to new migrations, preview branches and `supabase db reset`.
--
-- Two independent gates, do not confuse them:
--   GRANT = can this Postgres role touch the table at all
--   RLS   = which rows that role may see
-- A table needs BOTH. Grants without RLS is exactly the hole the advisor
-- flagged on 19 Sep 2026 (see migrations/012_rls_missing_tables.sql).

CREATE TABLE IF NOT EXISTS your_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Grants ---------------------------------------------------------------------
-- The dashboard runs as `authenticated` (session-bound client).
-- The voice agent, public booking, widget and crons run as `service_role`.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO service_role;

-- DO NOT grant to `anon` unless the table is genuinely public to the whole
-- internet. The anon key ships in the browser bundle. The Supabase email
-- suggests `GRANT SELECT ... TO anon` as the default - for this project it
-- almost never is. No table in ReservAItion currently needs it: every public
-- read path (slots, booking, widget config, iCal) goes through service_role
-- server-side.

-- RLS ------------------------------------------------------------------------
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "your_table_owner_all" ON your_table
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );
