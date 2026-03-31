interface KpiCardProps {
  label: string
  value: string
  trend?: number
  icon?: string
  gradient?: string
}

export function KpiCard({ label, value, trend, icon, gradient = 'from-indigo-950 to-indigo-900' }: KpiCardProps) {
  return (
    <div className={`rounded-2xl border border-indigo-800/40 bg-gradient-to-br ${gradient} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-indigo-300/70 font-semibold uppercase tracking-wider">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-3xl font-black text-white mb-1">{value}</div>
      {trend !== undefined && (
        <div className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs предходен период
        </div>
      )}
    </div>
  )
}
