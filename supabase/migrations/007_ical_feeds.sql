-- 007_ical_feeds.sql
-- Stores external iCal feed URLs per tenant for automatic sync
--
-- !! NEVER APPLIED IN PRODUCTION. Verified 25 Sep 2026 through the Data API with
-- the service-role key: `ical_feeds` does not exist and is absent from the 12
-- exposed tables. The nightly /api/cron/sync-ical job had therefore been failing
-- on its first query for months, and the import UI failed silently.
--
-- The iCal IMPORT feature was removed from the codebase on 25 Sep 2026, so the
-- routes and UI this table served no longer exist. Do not run this file unless
-- that feature is being revived, and if it is, add the grants from
-- supabase/TEMPLATE-new-table.sql. iCal EXPORT is unaffected and live.

CREATE TABLE IF NOT EXISTS ical_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ical_feeds_tenant_idx ON ical_feeds(tenant_id);

ALTER TABLE ical_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ical_feeds_tenant_own" ON ical_feeds
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );
