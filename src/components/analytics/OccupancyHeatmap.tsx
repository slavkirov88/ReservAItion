'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props { data: Array<{ dow: string; count: number }> }

export function OccupancyHeatmap({ data }: Props) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="rounded-2xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950/60 to-slate-900/60 p-5">
      <h3 className="text-sm font-semibold text-emerald-300/70 uppercase tracking-wider mb-4">Заетост по ден от седмицата</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="dow" tick={{ fill: '#6ee7b7', fontSize: 12 }} />
          <YAxis tick={{ fill: '#6ee7b7', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#064e3b', border: '1px solid #059669', borderRadius: 8 }} labelStyle={{ color: '#6ee7b7' }} formatter={(v: number) => [v, 'Резервации']} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={`rgba(16, 185, 129, ${0.3 + (entry.count / max) * 0.7})`} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
