import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = await createServiceClient()

  const [tenantsRes, reservationsRes] = await Promise.all([
    service.from('tenants').select('id, name, created_at'),
    service.from('reservations').select('id, tenant_id, status, created_at, check_in_date'),
  ])

  const tenants = tenantsRes.data || []
  const reservations = reservationsRes.data || []

  const tenantsByMonth: Record<string, number> = {}
  for (const t of tenants) {
    const month = t.created_at.slice(0, 7)
    tenantsByMonth[month] = (tenantsByMonth[month] || 0) + 1
  }

  const reservationsByMonth: Record<string, number> = {}
  for (const r of reservations) {
    const month = (r.check_in_date || r.created_at).slice(0, 7)
    reservationsByMonth[month] = (reservationsByMonth[month] || 0) + 1
  }

  const byTenant: Record<string, { name: string; count: number }> = {}
  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t.name || 'Unnamed']))
  for (const r of reservations) {
    if (!byTenant[r.tenant_id]) byTenant[r.tenant_id] = { name: tenantMap[r.tenant_id] || r.tenant_id, count: 0 }
    byTenant[r.tenant_id].count++
  }
  const topTenants = Object.values(byTenant).sort((a, b) => b.count - a.count).slice(0, 10)

  return NextResponse.json({
    summary: {
      activeTenantCount: tenants.length,
      totalReservations: reservations.length,
      confirmedReservations: reservations.filter(r => r.status === 'confirmed' || r.status === 'completed').length,
    },
    tenantsByMonth: Object.entries(tenantsByMonth).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
    reservationsByMonth: Object.entries(reservationsByMonth).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
    topTenants,
  })
}
