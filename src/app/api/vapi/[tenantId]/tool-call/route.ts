import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getInventory } from '@/lib/inventory'
import { formatOffersBg } from '@/lib/inventory/format-bg'

interface ToolCallPayload {
  message?: {
    toolCalls?: Array<{
      id?: string
      function?: {
        name?: string
        arguments?: string | Record<string, unknown>
      }
    }>
    call?: {
      id?: string
      customer?: { number?: string }
    }
  }
  call?: {
    id?: string
    customer?: { number?: string }
  }
  toolName?: string
  parameters?: Record<string, unknown>
}

/** Vapi sends numbers as strings, and an empty string is not a zero. */
function toCount(value: string | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params

  let payload: ToolCallPayload
  try {
    payload = JSON.parse(await request.text()) as ToolCallPayload
  } catch {
    return NextResponse.json({ result: 'Invalid request body' }, { status: 400 })
  }

  const toolCall = payload.message?.toolCalls?.[0]
  const toolCallId = toolCall?.id
  const toolName = toolCall?.function?.name || payload.toolName
  const rawArgs = toolCall?.function?.arguments
  let parameters: Record<string, string> = {}
  if (rawArgs) {
    if (typeof rawArgs === 'string') {
      try { parameters = JSON.parse(rawArgs) } catch { parameters = {} }
    } else {
      parameters = rawArgs as Record<string, string>
    }
  } else {
    parameters = (payload.parameters as Record<string, string>) || {}
  }

  const callerPhone = payload.message?.call?.customer?.number
    || payload.call?.customer?.number
    || null

  const vapiResult = (result: string) => {
    if (toolCallId) {
      return NextResponse.json({ results: [{ toolCallId, result }] })
    }
    return NextResponse.json({ result })
  }

  const supabase = await createServiceClient()

  // ── Check availability ──────────────────────────────────────────────────────
  if (toolName === 'get_available_room_types') {
    const { check_in_date, check_out_date, adults, children, children_ages } = parameters
    if (!check_in_date || !check_out_date) {
      return vapiResult('Моля уточнете датите на настаняване и напускане.')
    }
    const inventory = await getInventory(supabase, tenantId)
    const { offers, staleMinutes } = await inventory.availability(check_in_date, check_out_date, {
      adults: toCount(adults),
      children: toCount(children),
      childrenAges: children_ages || null,
    })
    return vapiResult(formatOffersBg(offers, check_in_date, check_out_date, { staleMinutes }))
  }

  // ── Send booking inquiry ────────────────────────────────────────────────────
  if (toolName === 'send_booking_inquiry') {
    const { guest_name, guest_phone, check_in_date, check_out_date, room_type, adults, children, children_ages, guest_email } = parameters
    const effectivePhone = guest_phone || callerPhone || ''

    if (!guest_name || !effectivePhone || !check_in_date) {
      return vapiResult('Липсват задължителни данни: три имена, телефон и желана дата.')
    }

    const inventory = await getInventory(supabase, tenantId)
    const result = await inventory.createBooking({
      guestName: guest_name,
      guestPhone: effectivePhone,
      guestEmail: guest_email || null,
      checkIn: check_in_date,
      checkOut: check_out_date || null,
      roomTypeRef: room_type || null,
      guests: { adults: toCount(adults), children: toCount(children), childrenAges: children_ages || null },
      // Clock's idempotency key: Vapi can send the same tool call twice.
      callId: payload.message?.call?.id || payload.call?.id || null,
    })

    // The database error is no longer swallowed. If nothing was written, the
    // guest hears that, not "записах запитването".
    return vapiResult(result.spokenResult)
  }

  // ── Get current date ────────────────────────────────────────────────────────
  if (toolName === 'get_current_date') {
    const now = new Date()
    const bgDate = now.toLocaleDateString('bg-BG', {
      timeZone: 'Europe/Sofia',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const isoDate = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
    return vapiResult(`Днес е ${bgDate}. ISO формат: ${isoDate}. Текуща година: ${isoDate.slice(0, 4)}.`)
  }

  return vapiResult('Неизвестна команда.')
}
