'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Props { data: Array<{ status: string; count: number }> }

const COLORS: Record<string, string> = { confirmed: '#4ade80', completed: '#34d399', cancelled: '#f87171', pending: '#fbbf24', no_show: '#94a3b8' }
const LABELS: Record<string, string> = { confirmed: 'Потвърдени', completed: 'Завършени', cancelled: 'Отказани', pending: 'Чакащи', no_show: 'No show' }

export function StatusDonutChart({ data }: Props) {
  const chartData = data.map(d => ({ name: LABELS[d.status] || d.status, value: d.count, status: d.status }))
  return (
    <div className="rounded-2xl border border-violet-800/40 bg-gradient-to-br from-violet-950/60 to-slate-900/60 p-5">
      <h3 className="text-sm font-semibold text-violet-300/70 uppercase tracking-wider mb-4">По статус</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={80}>
            {chartData.map((entry, i) => <Cell key={i} fill={COLORS[entry.status] || '#6366f1'} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid #7c3aed', borderRadius: 8 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#c4b5fd' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
