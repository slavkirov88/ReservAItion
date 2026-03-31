'use client'

export type Period = '7d' | '30d' | '90d' | '365d'

interface FiltersBarProps {
  period: Period
  onPeriodChange: (p: Period) => void
  roomTypeId: string
  onRoomTypeChange: (id: string) => void
  status: string
  onStatusChange: (s: string) => void
  roomTypes: Array<{ id: string; name: string }>
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7d', label: '7 дни' },
  { value: '30d', label: '30 дни' },
  { value: '90d', label: '90 дни' },
  { value: '365d', label: '1 година' },
]

const STATUSES = [
  { value: '', label: 'Всички статуси' },
  { value: 'confirmed', label: 'Потвърдени' },
  { value: 'cancelled', label: 'Отказани' },
  { value: 'completed', label: 'Завършени' },
  { value: 'pending', label: 'Чакащи' },
]

export function FiltersBar({ period, onPeriodChange, roomTypeId, onRoomTypeChange, status, onStatusChange, roomTypes }: FiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex rounded-xl border border-border overflow-hidden">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              period === p.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <select
        value={roomTypeId}
        onChange={e => onRoomTypeChange(e.target.value)}
        className="px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground"
      >
        <option value="">Всички типове</option>
        {roomTypes.map(rt => (
          <option key={rt.id} value={rt.id}>{rt.name}</option>
        ))}
      </select>
      <select
        value={status}
        onChange={e => onStatusChange(e.target.value)}
        className="px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground"
      >
        {STATUSES.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}
