import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendOwnerNotification } from '@/lib/email/resend'
import { getAvailableRoomTypes, formatAvailabilityBg } from '@/lib/availability'

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
      customer?: { number?: string }
    }
  }
  call?: {
    customer?: { number?: string }
  }
  toolName?: string
  parameters?: Record<string, unknown>
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
    const { check_in_date, check_out_date } = parameters
    if (!check_in_date || !check_out_date) {
      return vapiResult('Моля уточнете датите на настаняване и напускане.')
    }
    const available = await getAvailableRoomTypes(supabase, tenantId, check_in_date, check_out_date)
    return vapiResult(formatAvailabilityBg(available, check_in_date, check_out_date))
  }

  // ── Send booking inquiry ────────────────────────────────────────────────────
  if (toolName === 'send_booking_inquiry') {
    const { guest_name, guest_phone, check_in_date, check_out_date, room_type, guests_count } = parameters
    const effectivePhone = guest_phone || callerPhone || ''

    if (!guest_name || !effectivePhone || !check_in_date) {
      return vapiResult('Липсват задължителни данни: три имена, телефон и желана дата.')
    }

    // Look up room_type_id
    const { data: roomTypeData } = room_type
      ? await supabase.from('room_types').select('id').eq('tenant_id', tenantId).ilike('name', room_type).single()
      : { data: null }

    // Save inquiry to DB
    const { error } = await supabase.from('reservations').insert({
      tenant_id: tenantId,
      guest_name,
      guest_phone: effectivePhone,
      check_in_date,
      check_out_date: check_out_date || null,
      room_type_id: roomTypeData?.id || null,
      guests_count: guests_count ? Number(guests_count) : null,
      status: 'inquiry',
      channel: 'phone',
    })

    if (error) {
      console.error('[send_booking_inquiry] DB error:', JSON.stringify(error))
    }

    // Get owner email
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('business_name, owner_id')
      .eq('id', tenantId)
      .single()

    if (tenantData?.owner_id) {
      const { data: ownerData } = await supabase.auth.admin.getUserById(tenantData.owner_id)
      const ownerEmail = ownerData?.user?.email
      if (ownerEmail) {
        await sendOwnerNotification(ownerEmail, {
          guestName: guest_name,
          guestPhone: effectivePhone,
          checkInDate: check_in_date,
          checkOutDate: check_out_date || null,
          roomType: room_type || null,
          guestsCount: guests_count ? Number(guests_count) : null,
          channel: 'phone',
          hotelName: tenantData.business_name || 'Хотел',
        })
      }
    }

    return vapiResult('Записах запитването! Рецепцията ще се свърже с Вас. Довиждане!')
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
