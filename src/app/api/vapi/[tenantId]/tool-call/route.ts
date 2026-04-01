import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseISO, format } from 'date-fns'
import { sendReservationConfirmation, sendOwnerNotification, sendProformaToGuest, sendDepositOwnerNotification } from '@/lib/email/resend'
import { getAvailableRoomTypes, formatAvailabilityBg } from '@/lib/availability'

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

  const vapiSecret = request.headers.get('x-vapi-secret')
  const body = await request.text()

  if (process.env.VAPI_WEBHOOK_SECRET) {
    if (vapiSecret !== process.env.VAPI_WEBHOOK_SECRET) {
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
    const { check_in_date, check_out_date } = parameters

    if (!check_in_date || !check_out_date) {
      return NextResponse.json({ result: 'Моля уточнете датите на настаняване и напускане, за да проверя наличността.' })
    }

    const available = await getAvailableRoomTypes(supabase, tenantId, check_in_date, check_out_date)
    return NextResponse.json({ result: formatAvailabilityBg(available, check_in_date, check_out_date) })
  }

  if (toolName === 'book_reservation') {
    const { guest_name, guest_phone, guest_email, room_type, check_in_date, check_out_date, room_type_name } = parameters
    const total_amount = parameters.total_amount ? Number(parameters.total_amount) : undefined

    if (!guest_name || !guest_phone || !check_in_date) {
      return NextResponse.json({ result: 'Липсват задължителни полета: три имена, телефон и дата на настаняване.' })
    }

    // Look up room_type_id from name
    const { data: roomTypeData } = await supabase
      .from('room_types')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .ilike('name', room_type || '')
      .single()

    // Check real availability before booking
    if (check_out_date) {
      const available = await getAvailableRoomTypes(supabase, tenantId, check_in_date, check_out_date)
      const requestedType = available.find(r => roomTypeData ? r.id === roomTypeData.id : true)
      if (roomTypeData && !requestedType) {
        return NextResponse.json({
          result: `За съжаление ${roomTypeData.name} е заета за ${check_in_date} – ${check_out_date}. ${available.length > 0 ? `Свободни са: ${available.map(r => r.name).join(', ')}.` : 'Няма свободни стаи за този период.'}`
        })
      }
    }

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('business_name, phone, address, owner_id, bank_iban, bank_name, company_name, company_address, deposit_percent')
      .eq('id', tenantId)
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

    let ownerEmail: string | undefined
    if (tenantData?.owner_id) {
      const { data: ownerData } = await supabase.auth.admin.getUserById(tenantData.owner_id)
      ownerEmail = ownerData?.user?.email ?? undefined
    }

    const effectiveRoomTypeName = room_type_name || room_type || ''

    const hasDepositFlow =
      guest_email &&
      total_amount && total_amount > 0 &&
      tenantData?.bank_iban &&
      tenantData?.company_name

    if (hasDepositFlow && total_amount && tenantData) {
      const depositPercent = tenantData.deposit_percent ?? 30
      const depositAmount = Math.round(total_amount * depositPercent / 100 * 100) / 100
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

      await supabase
        .from('reservations')
        .update({
          status: 'pending_payment',
          guest_email,
          total_amount,
          deposit_amount: depositAmount,
          deposit_expires_at: expiresAt,
        })
        .eq('id', reservation.id)

      const deadlineFormatted = new Date(expiresAt).toLocaleDateString('bg-BG', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })

      await sendProformaToGuest(guest_email, {
        guestName: guest_name,
        roomTypeName: effectiveRoomTypeName,
        checkInDate: check_in_date,
        checkOutDate: check_out_date || '',
        totalAmount: total_amount,
        depositAmount,
        depositPercent,
        deadlineDate: deadlineFormatted,
        hotelName: tenantData.business_name || 'Хотел',
        companyName: tenantData.company_name as string,
        companyAddress: (tenantData.company_address as string | null) || '',
        bankIban: tenantData.bank_iban as string,
        bankName: (tenantData.bank_name as string | null) || '',
      })

      if (ownerEmail) {
        await sendDepositOwnerNotification(ownerEmail, {
          guestName: guest_name,
          guestEmail: guest_email,
          guestPhone: guest_phone || '',
          roomTypeName: effectiveRoomTypeName,
          checkInDate: check_in_date,
          checkOutDate: check_out_date || '',
          totalAmount: total_amount,
          depositAmount,
          deadlineDate: deadlineFormatted,
        })
      }
    } else {
      if (guest_email) {
        await sendReservationConfirmation(guest_email, {
          guestName: guest_name,
          checkInDate: check_in_date,
          checkOutDate: check_out_date || null,
          roomType: room_type || null,
          hotelName: tenantData?.business_name ?? 'Хотел',
          hotelPhone: tenantData?.phone ?? null,
          hotelAddress: tenantData?.address ?? null,
        })
      }

      if (ownerEmail) {
        await sendOwnerNotification(ownerEmail, {
          guestName: guest_name,
          guestPhone: guest_phone,
          checkInDate: check_in_date,
          checkOutDate: check_out_date || null,
          roomType: room_type || null,
          channel: 'phone',
          hotelName: tenantData?.business_name ?? 'Хотел',
        })
      }
    }

    const checkIn = parseISO(check_in_date)
    return NextResponse.json({
      result: `Резервацията е потвърдена! ${guest_name}, настанявате се на ${format(checkIn, 'dd.MM.yyyy')}. Ще получите потвърждение.`
    })
  }

  if (toolName === 'get_current_date') {
    const now = new Date()
    const bgDate = now.toLocaleDateString('bg-BG', {
      timeZone: 'Europe/Sofia',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const isoDate = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' }) // YYYY-MM-DD
    return NextResponse.json({
      result: `Днес е ${bgDate}. ISO формат: ${isoDate}. Текуща година: ${isoDate.slice(0, 4)}.`
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
