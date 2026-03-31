'use client'
import { useState, useEffect, useCallback } from 'react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { FiltersBar, type Period } from '@/components/analytics/FiltersBar'
import { RevenueChart } from '@/components/analytics/RevenueChart'
import { ReservationsByTypeChart } from '@/components/analytics/ReservationsByTypeChart'
import { StatusDonutChart } from '@/components/analytics/StatusDonutChart'
import { OccupancyHeatmap } from '@/components/analytics/OccupancyHeatmap'

function periodToDates(period: Period): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[period]
  from.setDate(from.getDate() - days)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [roomTypeId, setRoomTypeId] = useState('')
  const [status, setStatus] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { from, to } = periodToDates(period)
    const params = new URLSearchParams({ from, to })
    if (roomTypeId) params.set('room_type_id', roomTypeId)
    if (status) params.set('status', status)
    const res = await fetch(`/api/analytics/hotel?${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [period, roomTypeId, status])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Анализи</h1>
        <p className="text-muted-foreground text-sm mt-1">Приходи, заетост и резервации</p>
      </div>
      <FiltersBar period={period} onPeriodChange={setPeriod} roomTypeId={roomTypeId} onRoomTypeChange={setRoomTypeId} status={status} onStatusChange={setStatus} roomTypes={data?.filterOptions || []} />
      {loading ? (
        <div className="text-muted-foreground text-sm">Зареждане...</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Общи приходи" value={`€${data.summary.totalRevenue.toLocaleString()}`} icon="💰" gradient="from-indigo-950 to-indigo-900" />
            <KpiCard label="Резервации" value={String(data.summary.totalReservations)} icon="📅" gradient="from-cyan-950 to-cyan-900" />
            <KpiCard label="Отказани" value={`${data.summary.cancelRate}%`} icon="❌" gradient="from-rose-950 to-rose-900" />
            <KpiCard label="Потвърдени" value={String(data.summary.totalReservations - data.summary.cancelledCount)} icon="✅" gradient="from-emerald-950 to-emerald-900" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:col-span-2"><RevenueChart data={data.revenueByDay} /></div>
            <ReservationsByTypeChart data={data.byRoomType} />
            <StatusDonutChart data={data.statusBreakdown} />
            <div className="lg:col-span-2"><OccupancyHeatmap data={data.occupancyByDow} /></div>
          </div>
        </>
      ) : (
        <div className="text-muted-foreground text-sm">Няма данни</div>
      )}
    </div>
  )
}
