import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateInvoicePDF, sendInvoiceEmail } from '@/lib/hotel/invoice'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id, business_name, address').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const { data: reservation } = await supabase
    .from('room_reservations')
    .select('guest_name, check_in, check_out, nights, total_price, rooms(name)')
    .eq('invoice_id', id)
    .single()

  try {
    const invoiceData = {
      invoiceNumber: invoice.invoice_number ?? id,
      hotelName: (tenant as { business_name: string }).business_name,
      hotelAddress: (tenant as { address?: string }).address ?? '',
      guestName: reservation?.guest_name ?? '',
      guestEmail: invoice.guest_email,
      guestPhone: invoice.guest_phone ?? '',
      roomName: (reservation?.rooms as unknown as { name: string } | null)?.name ?? '',
      checkIn: reservation?.check_in ?? '',
      checkOut: reservation?.check_out ?? '',
      nights: reservation?.nights ?? 0,
      pricePerNight: reservation ? reservation.total_price / (reservation.nights || 1) : 0,
      totalPrice: invoice.amount,
      currency: invoice.currency ?? 'EUR',
      stripePaymentLink: invoice.stripe_payment_link ?? '',
      expiresAt: invoice.expires_at ?? new Date().toISOString(),
    }

    const pdfBuffer = await generateInvoicePDF(invoiceData)
    await sendInvoiceEmail(invoiceData, pdfBuffer)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Resend invoice error:', err)
    return NextResponse.json({ error: 'Failed to resend invoice' }, { status: 500 })
  }
}
