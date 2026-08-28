-- 009_reservations_service_nullable.sql
-- Root-cause fix: `reservations` inherited a NOT NULL `service` column from the
-- old appointments schema. The booking flow (send_booking_inquiry) never sets it,
-- so every phone/chat reservation insert silently failed the NOT NULL constraint
-- (the API only logged the error and still returned success). This drops the
-- constraint so hotel reservations can be written without a meaningless `service`.

ALTER TABLE reservations
  ALTER COLUMN service DROP NOT NULL;

-- Same root cause: the table was cloned from `appointments` and kept the stale
-- CHECK constraint `appointments_status_check`, which only allows
-- confirmed/cancelled/no_show/completed and REJECTS 'inquiry'. Migration 008
-- tried to fix this but dropped the wrong constraint name (reservations_status_check),
-- so the appointments-named one survived and still blocks every booking inquiry.
-- Drop the stale constraint; the correct reservations_status_check (added in 008,
-- which allows 'inquiry') remains and enforces the valid set.
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS appointments_status_check;

-- Belt-and-suspenders: (re)ensure the correct status constraint exists and allows
-- 'inquiry'. Idempotent — safe to run repeatedly.
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('inquiry', 'confirmed', 'cancelled', 'pending_payment', 'no_show', 'completed'));
