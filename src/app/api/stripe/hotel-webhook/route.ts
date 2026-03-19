import { stripe } from '@/lib/stripe/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_HOTEL_WEBHOOK_SECRET

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object
  const invoiceId = session.metadata?.invoice_id
  if (!invoiceId) return NextResponse.json({ received: true })

  const supabase = await createServiceClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (!invoice) return NextResponse.json({ received: true })

  // Already paid — idempotent exit
  if (invoice.status === 'paid') {
    return NextResponse.json({ received: true })
  }

  // Expired — cron already cancelled; refund and notify
  if (invoice.status === 'expired') {
    try {
      await stripe.refunds.create({ payment_intent: session.payment_intent as string })
      const { error: refundEmailError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@hotelai.app',
        to: invoice.guest_email,
        subject: 'Резервацията е изтекла — възстановяване на плащане',
        html: `<p>Съжаляваме, но резервационният период от 48 часа е изтекъл. Вашето плащане ще бъде възстановено в рамките на 5-7 работни дни.</p>`,
      })
      if (refundEmailError) console.error('Refund email failed:', refundEmailError.message)
    } catch (err) {
      console.error('Refund flow error:', err)
    }
    return NextResponse.json({ received: true })
  }

  // Idempotency: store stripe event id
  if (invoice.stripe_event_id === event.id) {
    return NextResponse.json({ received: true })
  }

  // Confirm reservation
  await supabase.from('invoices').update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    stripe_event_id: event.id,
  }).eq('id', invoiceId)

  await supabase.from('room_reservations').update({ status: 'confirmed' })
    .eq('invoice_id', invoiceId)

  // Send confirmation email
  const { error: confirmEmailError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@hotelai.app',
    to: invoice.guest_email,
    subject: 'Резервацията е потвърдена!',
    html: `<p>Вашата резервация е потвърдена. Очакваме ви!</p>`,
  })
  if (confirmEmailError) console.error('Confirmation email failed:', confirmEmailError.message)

  return NextResponse.json({ received: true })
}
