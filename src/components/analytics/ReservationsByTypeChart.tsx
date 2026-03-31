'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props { data: Array<{ name: string; count: number; revenue: number }> }

export function ReservationsByTypeChart({ data }: Props) {
  return (
    <div className="rounded-2xl border border-cyan-800/40 bg-gradient-to-br from-cyan-950/60 to-slate-900/60 p-5">
      <h3 className="text-sm font-semibold text-cyan-300/70 uppercase tracking-wider mb-4">Резервации по тип стая</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#164e63" />
          <XAxis dataKey="name" tick={{ fill: '#a5f3fc', fontSize: 11 }} />
          <YAxis tick={{ fill: '#a5f3fc', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#0c2340', border: '1px solid #0891b2', borderRadius: 8 }} labelStyle={{ color: '#a5f3fc' }} />
          <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} name="Резервации" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
