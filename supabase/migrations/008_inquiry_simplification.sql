-- 008_inquiry_simplification.sql
-- Simplify reservations: add inquiry status and guests_count

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS guests_count INTEGER;

-- Add 'inquiry' to allowed statuses
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('inquiry', 'confirmed', 'cancelled', 'pending_payment', 'no_show', 'completed'));
