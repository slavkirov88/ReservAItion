-- 007_ical_feeds.sql
-- Stores external iCal feed URLs per tenant for automatic sync

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
