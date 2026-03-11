'use client'

interface HourData {
  hour: number
  count: number
}

export function CallsByHourChart({ data }: { data: HourData[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-32">
        {data.map(({ hour, count }) => (
          <div key={hour} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full rounded-t-sm bg-primary/80 transition-all"
              style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
              title={`${hour}:00 — ${count} часа`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {data.map(({ hour }) => (
          <div key={hour} className="flex-1 text-center text-xs text-muted-foreground">
            {hour}
          </div>
        ))}
      </div>
    </div>
  )
}
