import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const checkoutDate = searchParams.get('checkout_date')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = 20

  let query = supabase
    .from('reservations')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .order('check_in_date', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status) query = query.eq('status', status as 'inquiry' | 'confirmed' | 'cancelled' | 'no_show' | 'completed' | 'pending_payment')
  if (from) query = query.gte('check_in_date', from)
  if (to) query = query.lte('check_in_date', to)
  if (checkoutDate) {
    query = query.gte('check_out_date', `${checkoutDate}T00:00:00`)
    query = query.lte('check_out_date', `${checkoutDate}T23:59:59`)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reservations: data, total: count, page, pageSize })
}
