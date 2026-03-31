'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props { data: Array<{ date: string; revenue: number }> }

export function RevenueChart({ data }: Props) {
  return (
    <div className="rounded-2xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/60 to-slate-900/60 p-5">
      <h3 className="text-sm font-semibold text-indigo-300/70 uppercase tracking-wider mb-4">Приходи по дни</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#312e81" />
          <XAxis dataKey="date" tick={{ fill: '#a5b4fc', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
          <YAxis tick={{ fill: '#a5b4fc', fontSize: 11 }} tickFormatter={v => `€${v}`} />
          <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid #4338ca', borderRadius: 8 }} labelStyle={{ color: '#a5b4fc' }} formatter={(v: number) => [`€${v.toFixed(2)}`, 'Приходи']} />
          <Line type="monotone" dataKey="revenue" stroke="#818cf8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
