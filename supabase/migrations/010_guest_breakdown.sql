-- 010_guest_breakdown.sql
-- Split guest count into adults + children so the AI never has to collapse
-- "2 adults and 1 child" into a single ambiguous number.
-- guests_count is kept as the total (adults + children) for backward compatibility.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS adults INTEGER,
  ADD COLUMN IF NOT EXISTS children INTEGER,
  ADD COLUMN IF NOT EXISTS children_ages TEXT;