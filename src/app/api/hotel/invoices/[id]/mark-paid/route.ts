import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mark invoice paid (manual bank transfer confirmation)
  const { error: invErr } = await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenant.id)
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 })

  // Also confirm the reservation
  await supabase
    .from('room_reservations')
    .update({ status: 'confirmed' })
    .eq('invoice_id', id)

  return NextResponse.json({ ok: true })
}
