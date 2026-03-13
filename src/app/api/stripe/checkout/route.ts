import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PLANS, type PlanKey } from '@/lib/stripe/stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { planKey } = await request.json() as { planKey: PlanKey }
    const plan = PLANS[planKey]
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, stripe_customer_id')
      .eq('owner_id', user.id)
      .single()

    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

    let customerId = tenant.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { tenantId: tenant.id },
      })
      customerId = customer.id
      await supabase.from('tenants').update({ stripe_customer_id: customerId }).eq('id', tenant.id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?subscribed=true`,
      cancel_url: `${appUrl}/subscription`,
      metadata: { tenantId: tenant.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
