import { parseLeadPayload } from '@/lib/lead-payload'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export const MAX_HISTORY = 20
export const MAX_MESSAGE_CHARS = 600

// The client sends the whole history, so it cannot be trusted: keep only plain
// user/assistant strings, cap how many and how long.
export function sanitizeHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return []
  const out: ChatMessage[] = []
  for (const m of input) {
    if (!m || typeof m !== 'object') continue
    const { role, content } = m as Record<string, unknown>
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) continue
    out.push({ role, content: content.slice(0, 1000) })
  }
  // The API requires the first message to be from the user.
  const trimmed = out.slice(-MAX_HISTORY)
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift()
  return trimmed
}

// Lead data the model collected goes through the same validation as the form.
export function validateChatLead(args: Record<string, unknown>) {
  return parseLeadPayload({
    stage: 'contact',
    leadId: crypto.randomUUID(),
    name: args.name,
    phone: args.phone,
    email: args.email,
    property: args.property,
  })
}

// Best-effort limiter per IP. In-memory, so it only slows down a single warm
// server instance; it keeps casual abuse from running up model costs.
const hits = new Map<string, number[]>()
export function rateLimited(ip: string, limit = 20, windowMs = 10 * 60 * 1000, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return false
}
