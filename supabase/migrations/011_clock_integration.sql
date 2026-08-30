-- 011_clock_integration.sql
-- Per-tenant Clock PMS+ wiring: credentials on the row, a cache for their
-- heaviest endpoint, and a log that keeps a repeated tool call from creating
-- the same booking twice.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Clock's own guidance: rates_availability "consumes a highest amount of
-- application resources", refresh every 15-20 minutes and cache on our side.
-- The voice agent never calls it during a conversation.
--
-- price_cents and currency are stored exactly as Clock returns them. The
-- sandbox answers in BGN while our own inventory is priced in EUR, so nothing
-- here converts anything: an agent that says "eighty euro" for an eighty lev
-- room is worse than an agent that says nothing.
CREATE TABLE IF NOT EXISTS clock_availability_cache (
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clock_room_type_id  integer NOT NULL,
  room_type_name      text,
  clock_rate_id       integer NOT NULL,
  date                date NOT NULL,
  free                boolean NOT NULL DEFAULT false,
  price_cents         integer,
  currency            text,
  free_rooms          integer,
  min_stay            integer,
  closed_for_arrival  boolean NOT NULL DEFAULT false,
  stop_from_sale      boolean NOT NULL DEFAULT false,
  fetched_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, clock_room_type_id, clock_rate_id, date)
);

CREATE INDEX IF NOT EXISTS clock_availability_cache_lookup
  ON clock_availability_cache (tenant_id, date);

-- Vapi retries a tool call it thinks timed out. Without this the guest gets
-- two bookings in the hotel's PMS and we find out from the hotel.
CREATE TABLE IF NOT EXISTS clock_booking_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vapi_call_id      text NOT NULL,
  clock_booking_id  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clock_booking_log_call
  ON clock_booking_log (tenant_id, vapi_call_id);

ALTER TABLE clock_availability_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_booking_log ENABLE ROW LEVEL SECURITY;
-- Both tables are written only by the service role (the refresh endpoint and
-- the tool-call route). No policy is added on purpose: RLS on with no policy
-- denies the anon and authenticated roles outright.
