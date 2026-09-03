// ---------------------------------------------------------------------------
// The seam between what the agent hears and what Clock accepts.
//
// Our own column is text, because the guest says "5 и 8 години" and forcing
// that into a number list mid-call loses the answer. Clock's parameters are
// integers: `children_ages[]=5&children_ages[]=8`. Without this conversion a
// rate priced per person is quoted wrongly, and quietly.
// ---------------------------------------------------------------------------

/** Nobody older than this is a child for pricing purposes. */
const MAX_CHILD_AGE = 17

/**
 * Numbers a guest could plausibly have meant as a child's age.
 *
 * Anything above seventeen is thrown away rather than clamped: the agent
 * sometimes weaves a year into the sentence ("2026 година, детето е на 4"),
 * and a year turned into an age would be worse than a missing one.
 */
export function parseChildrenAges(input: string | null | undefined): number[] {
  if (!input) return []

  return (input.match(/\d+/g) ?? [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= MAX_CHILD_AGE)
}
