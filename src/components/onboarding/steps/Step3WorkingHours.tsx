'use client'

import { Input } from '@/components/ui/input'

const DAYS = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота']

export interface WorkingHour {
  day_of_week: number
  is_active: boolean
  start_time: string
  end_time: string
  slot_duration_min: number
  break_start: string
  break_end: string
}

interface Props {
  workingHours: WorkingHour[]
  onChange: (hours: WorkingHour[]) => void
}

export function Step3WorkingHours({ workingHours, onChange }: Props) {
  function update(index: number, field: keyof WorkingHour, value: string | boolean | number) {
    onChange(workingHours.map((h, i) => i === index ? { ...h, [field]: value } : h))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Задайте работното си време за всеки ден.
      </p>
      <div className="space-y-2">
        {workingHours.map((hour, i) => (
          <div key={i} className={`rounded-lg border p-3 space-y-2 ${hour.is_active ? 'border-border' : 'border-border/40 opacity-60'}`}>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hour.is_active}
                onChange={e => update(i, 'is_active', e.target.checked)}
                className="h-4 w-4 accent-primary"
                id={`day-${i}`}
              />
              <label htmlFor={`day-${i}`} className="font-medium text-sm w-24 cursor-pointer">
                {DAYS[hour.day_of_week]}
              </label>
              {hour.is_active && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="time"
                    value={hour.start_time}
                    onChange={e => update(i, 'start_time', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground text-sm">—</span>
                  <Input
                    type="time"
                    value={hour.end_time}
                    onChange={e => update(i, 'end_time', e.target.value)}
                    className="w-28"
                  />
                  <Input
                    type="number"
                    value={hour.slot_duration_min}
                    onChange={e => update(i, 'slot_duration_min', Number(e.target.value))}
                    min={5}
                    className="w-16"
                    title="Минути на слот"
                  />
                  <span className="text-xs text-muted-foreground">мин</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
