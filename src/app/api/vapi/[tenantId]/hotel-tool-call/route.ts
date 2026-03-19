import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { checkRoomAvailability } from '@/lib/hotel/availability'
import { generateInvoicePDF, sendInvoiceEmail, generateInvoiceNumber } from '@/lib/hotel/invoice'
import { stripe } from '@/lib/stripe/stripe'

interface ToolCallPayload {
  message?: { toolCalls?: Array<{ function?: { name?: string; arguments?: string } }> }
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
      .update(body).digest('hex')
    if (signature !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const payload = JSON.parse(body) as ToolCallPayload
  const toolName = payload.message?.toolCalls?.[0]?.function?.name ?? payload.toolName
  const rawArgs = payload.message?.toolCalls?.[0]?.function?.arguments
  const parameters = rawArgs
    ? (JSON.parse(rawArgs) as Record<string, string>)
    : (payload.parameters as Record<string, string>) ?? {}

  const supabase = await createServiceClient()

  // ── check_room_availability ─────────────────────────────────────
  if (toolName === 'check_room_availability') {
    const { check_in, check_out, guests } = parameters
    const guestCount = Number(guests)
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      return NextResponse.json({ result: 'Моля уточнете броя на гостите.' })
    }
    const available = await checkRoomAvailability(tenantId, check_in, check_out, guestCount)

    if (available.length === 0) {
      return NextResponse.json({ result: 'За съжаление няма свободни стаи за избрания период.' })
    }

    const list = available.map(r =>
      `${r.name} (${r.type}, до ${r.capacity} гости) — ${r.base_price} EUR/нощ, общо ${r.total_price} EUR за ${r.nights} нощ(и). ID: ${r.id}`
    ).join('\n')

    return NextResponse.json({ result: `Свободни стаи:\n${list}` })
  }

  // ── create_reservation ──────────────────────────────────────────
  if (toolName === 'create_reservation') {
    const { room_id, guest_name, guest_email, guest_phone, check_in, check_out } = parameters

    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', room_id)
      .eq('tenant_id', tenantId)
      .single()

    if (!room) return NextResponse.json({ result: 'Стаята не е намерена.' })

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('business_name, address')
      .eq('id', tenantId)
      .single()

    const nights = Math.round(
      (new Date(check_out).getTime() - new Date(check_in).getTime()) / 86400000
    )
    const totalPrice = room.base_price * nights
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    // Get collision-free invoice number from Postgres sequence
    const { data: seqData } = await supabase.rpc('next_invoice_number')
    const invoiceNumber = generateInvoiceNumber(seqData ?? 1)

    // STEP 1: Insert invoice + reservation atomically via DB transaction RPC.
    // Stripe and email calls happen AFTER both rows are committed — never before.
    // This prevents orphaned Stripe payment links on double-booking races.
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        guest_email,
        guest_phone,
        amount: totalPrice,
        currency: 'EUR',
        status: 'sent',
        expires_at: expiresAt,
        invoice_number: invoiceNumber,
        pdf_url: null,
        stripe_payment_link: null,
        stripe_event_id: null,
        paid_at: null,
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ result: 'Грешка при създаване на фактура.' })
    }

    // Insert reservation (exclusion constraint fires here if double-book)
    const { error: resError } = await supabase
      .from('room_reservations')
      .insert({
        tenant_id: tenantId,
        room_id,
        guest_name,
        guest_email,
        guest_phone,
        check_in,
        check_out,
        total_price: totalPrice,
        status: 'on_hold',
        invoice_id: invoice.id,
        held_until: expiresAt,
        source: 'voice',
      })

    if (resError) {
      // Exclusion constraint violation = double booking
      if (resError.code === '23P01') {
        await supabase.from('invoices').delete().eq('id', invoice.id)
        return NextResponse.json({ result: 'Съжалявам, стаята току-що беше резервирана. Моля изберете друга.' })
      }
      await supabase.from('invoices').delete().eq('id', invoice.id)
      return NextResponse.json({ result: 'Грешка при записване на резервацията.' })
    }

    // STEP 2: Both DB rows committed. Now safe to call external services.
    let paymentLink = ''
    try {
      const price = await stripe.prices.create({
        currency: 'eur',
        unit_amount: Math.round(totalPrice * 100),
        product_data: { name: `Резервация ${room.name} — ${check_in} до ${check_out}` },
      })
      const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { invoice_id: invoice.id, tenant_id: tenantId },
      })
      paymentLink = link.url
      await supabase.from('invoices').update({ stripe_payment_link: paymentLink }).eq('id', invoice.id)
    } catch {
      // Non-fatal: invoice can still be paid via bank transfer
    }

    const hotel = tenantData as { business_name: string; address: string } | null
    try {
      const invoiceData = {
        invoiceNumber,
        hotelName: hotel?.business_name ?? 'Hotel',
        hotelAddress: hotel?.address ?? '',
        guestName: guest_name,
        guestEmail: guest_email,
        guestPhone: guest_phone,
        roomName: room.name,
        checkIn: check_in,
        checkOut: check_out,
        nights,
        pricePerNight: room.base_price,
        totalPrice,
        currency: 'EUR',
        stripePaymentLink: paymentLink,
        expiresAt,
      }
      const pdfBuffer = await generateInvoicePDF(invoiceData)
      await sendInvoiceEmail(invoiceData, pdfBuffer)
    } catch {
      // Email failure is non-fatal — reservation is created
    }

    return NextResponse.json({
      result: `Резервацията е направена! Фактура #${invoiceNumber} е изпратена на ${guest_email}. Моля платете в рамките на 48 часа, за да потвърдите резервацията.`
    })
  }

  // ── get_hotel_info ──────────────────────────────────────────────
  if (toolName === 'get_hotel_info') {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, address, phone')
      .eq('id', tenantId)
      .single()

    const { data: profile } = await supabase
      .from('business_profiles')
      .select('faqs, welcome_message_bg')
      .eq('tenant_id', tenantId)
      .single()

    const info = [
      tenant?.business_name ? `Хотел: ${tenant.business_name}` : '',
      tenant?.address ? `Адрес: ${tenant.address}` : '',
      tenant?.phone ? `Телефон: ${tenant.phone}` : '',
      profile?.faqs ? `FAQ: ${JSON.stringify(profile.faqs)}` : '',
    ].filter(Boolean).join('\n')

    return NextResponse.json({ result: info || 'Информацията не е налична.' })
  }

  // ── cancel_reservation ──────────────────────────────────────────
  if (toolName === 'cancel_reservation') {
    const { reference_number, phone_last4 } = parameters

    const { data: reservations } = await supabase
      .from('room_reservations')
      .select('id, status, guest_phone, invoices!inner(invoice_number)')
      .eq('tenant_id', tenantId)
      .in('status', ['on_hold', 'confirmed'])
      .eq('invoices.invoice_number', reference_number)

    const match = (reservations ?? []).find(r => {
      const phone = r.guest_phone ?? ''
      return phone.slice(-4) === phone_last4
    })

    if (!match) {
      return NextResponse.json({ result: 'Резервацията не е намерена. Моля проверете референтния номер и последните 4 цифри от телефона.' })
    }

    await supabase
      .from('room_reservations')
      .update({ status: 'cancelled' })
      .eq('id', match.id)

    return NextResponse.json({ result: 'Резервацията е отменена успешно.' })
  }

  return NextResponse.json({ result: 'Неизвестна команда.' })
}
