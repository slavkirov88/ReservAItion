import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { parseISO, format } from 'date-fns'

interface ToolCallPayload {
  message?: {
    toolCalls?: Array<{
      function?: {
        name?: string
        arguments?: string
      }
    }>
  }
  toolName?: string
  parameters?: Record<string, unknown>
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params

  const signature = request.headers.get('x-vapi-signature')
  const body = await request.text()

  if (process.env.VAPI_WEBHOOK_SECRET && signature) {
    const expected = crypto
      .createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET)
      .update(body)
      .digest('hex')
    if (signature !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const payload = JSON.parse(body) as ToolCallPayload
  const toolName = payload.message?.toolCalls?.[0]?.function?.name || payload.toolName
  const rawArgs = payload.message?.toolCalls?.[0]?.function?.arguments
  const parameters = rawArgs
    ? (JSON.parse(rawArgs) as Record<string, string>)
    : (payload.parameters as Record<string, string>) || {}

  const supabase = await createServiceClient()

  if (toolName === 'get_available_room_types') {
    const { data: roomTypes } = await supabase
      .from('room_types')
      .select('name, capacity, price_per_night')
      .eq('tenant_id', tenantId)

    if (!roomTypes || roomTypes.length === 0) {
      return NextResponse.json({ result: 'Няма налични типове стаи.' })
    }

    const list = roomTypes.map(r => `${r.name} (до ${r.capacity} гости, ${r.price_per_night} лв/нощ)`).join(', ')
    return NextResponse.json({ result: `Налични типове стаи: ${list}` })
  }

  if (toolName === 'book_reservation') {
    const { guest_name, guest_phone, room_type, check_in_date, check_out_date } = parameters

    // Look up room_type_id from name
    const { data: roomTypeData } = await supabase
      .from('room_types')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', room_type || '')
      .single()

    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        tenant_id: tenantId,
        guest_name,
        guest_phone,
        check_in_date,
        check_out_date: check_out_date || null,
        room_type_id: roomTypeData?.id || null,
        status: 'confirmed',
        channel: 'phone',
      })
      .select('id')
      .single()

    if (error || !reservation) {
      return NextResponse.json({ result: 'Грешка при резервацията. Моля опитайте отново.' })
    }

    const checkIn = parseISO(check_in_date)
    return NextResponse.json({
      result: `Резервацията е потвърдена! ${guest_name}, настанявате се на ${format(checkIn, 'dd.MM.yyyy')}. Ще получите потвърждение.`
    })
  }

  if (toolName === 'get_business_info') {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, address, phone')
      .eq('id', tenantId)
      .single()

    const { data: roomTypes } = await supabase
      .from('room_types')
      .select('name, capacity, price_per_night')
      .eq('tenant_id', tenantId)

    const info = [
      tenant?.business_name ? `Хотел: ${tenant.business_name}` : '',
      tenant?.address ? `Адрес: ${tenant.address}` : '',
      tenant?.phone ? `Телефон: ${tenant.phone}` : '',
      roomTypes?.length ? `Стаи: ${roomTypes.map(r => r.name).join(', ')}` : '',
    ].filter(Boolean).join('\n')

    return NextResponse.json({ result: info || 'Информацията не е налична.' })
  }

  return NextResponse.json({ result: 'Неизвестна команда.' })
}
