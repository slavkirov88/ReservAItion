-- Enable btree_gist for exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Extend tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'clinic',
  ADD COLUMN IF NOT EXISTS notion_access_token TEXT,
  ADD COLUMN IF NOT EXISTS notion_database_id TEXT;

-- Rooms
CREATE TABLE rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('single', 'double', 'suite', 'apartment')),
  capacity    INT NOT NULL DEFAULT 2,
  base_price  DECIMAL(10,2) NOT NULL,
  amenities   JSONB NOT NULL DEFAULT '[]',
  ical_url    TEXT,
  ical_export_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON rooms
  USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Invoices (created before reservations to avoid circular FK)
CREATE TABLE invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_email          TEXT NOT NULL,
  guest_phone          TEXT NOT NULL,
  amount               DECIMAL(10,2) NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'EUR',
  pdf_url              TEXT,
  stripe_payment_link  TEXT,
  stripe_event_id      TEXT,
  status               TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'paid', 'expired')),
  sent_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL,
  paid_at              TIMESTAMPTZ
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON invoices
  USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Room reservations
CREATE TABLE room_reservations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  guest_name  TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  check_in    DATE NOT NULL,
  check_out   DATE NOT NULL,
  nights      INT GENERATED ALWAYS AS (check_out - check_in) STORED,
  total_price DECIMAL(10,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'on_hold' CHECK (status IN ('on_hold', 'confirmed', 'cancelled')),
  invoice_id  UUID REFERENCES invoices(id),
  held_until  TIMESTAMPTZ NOT NULL,
  source      TEXT NOT NULL DEFAULT 'chat' CHECK (source IN ('voice', 'chat', 'manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_out > check_in)
);

-- Exclusion constraint: no overlapping active reservations for the same room
ALTER TABLE room_reservations
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (status IN ('on_hold', 'confirmed'));

ALTER TABLE room_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON room_reservations
  USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Invoice sequence for collision-free invoice numbers
CREATE SEQUENCE invoice_number_seq START 1;

-- RPC to get next invoice number (safe for concurrent calls)
CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS BIGINT LANGUAGE sql AS $$
  SELECT nextval('invoice_number_seq');
$$;

-- Add invoice_number column to invoices for reference-based lookups
ALTER TABLE invoices ADD COLUMN invoice_number TEXT UNIQUE;

-- iCal blocks (external calendar events blocking dates)
CREATE TABLE ical_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  summary     TEXT,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ical_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ical_blocks
  USING (tenant_id = (SELECT id FROM tenants WHERE owner_id = auth.uid()));
