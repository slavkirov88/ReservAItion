'use client'
import { useState, useEffect } from 'react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ReservationsByTypeChart } from '@/components/analytics/ReservationsByTypeChart'

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics/admin')
      .then(r => { if (r.status === 403) throw new Error('Нямаш достъп до admin панела'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-muted-foreground">Зареждане...</div>
  if (error) return <div className="p-6 text-rose-400">{error}</div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Анализи</h1>
        <p className="text-muted-foreground text-sm mt-1">Всички хотели в платформата</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Активни хотели" value={String(data.summary.activeTenantCount)} icon="🏨" gradient="from-indigo-950 to-indigo-900" />
        <KpiCard label="Общо резервации" value={String(data.summary.totalReservations)} icon="📅" gradient="from-cyan-950 to-cyan-900" />
        <KpiCard label="Потвърдени" value={String(data.summary.confirmedReservations)} icon="✅" gradient="from-emerald-950 to-emerald-900" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReservationsByTypeChart data={data.tenantsByMonth.map((d: any) => ({ name: d.month, count: d.count, revenue: 0 }))} />
        <ReservationsByTypeChart data={data.topTenants.map((d: any) => ({ name: d.name, count: d.count, revenue: 0 }))} />
      </div>
    </div>
  )
}
