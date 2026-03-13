import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const tenantId = session.metadata?.tenantId
    const subscriptionId = session.subscription as string
    if (tenantId) {
      await supabase.from('tenants').update({
        subscription_status: 'active',
        stripe_subscription_id: subscriptionId,
      }).eq('id', tenantId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await supabase.from('tenants')
      .update({ subscription_status: 'cancelled' })
      .eq('stripe_subscription_id', sub.id)
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const subId = invoice.parent?.subscription_details?.subscription as string | undefined
    if (subId) {
      await supabase.from('tenants')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_subscription_id', subId)
    }
  }

  return NextResponse.json({ received: true })
}
