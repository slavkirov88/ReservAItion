'use client'
import { useState, useEffect } from 'react'
import { addDays, startOfWeek, format, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns'
import { bg } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'

const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const h = 8 + Math.floor(i / 2)
  const m = (i % 2) * 30
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}).filter(t => t <= '20:00')

type Appointment = {
  id: string
  patient_name: string
  patient_phone: string
  service: string
  starts_at: string
  ends_at: string
  status: string
  channel: string
  notes: string | null
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-500/80 border-green-400 text-white',
  cancelled: 'bg-red-500/30 border-red-500/50 text-red-300',
  completed: 'bg-blue-500/70 border-blue-400 text-white',
  no_show: 'bg-yellow-500/60 border-yellow-400 text-white',
}

function getTimeMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function apptToSlotIndex(dateStr: string): number {
  const date = parseISO(dateStr)
  const h = date.getHours()
  const m = date.getMinutes()
  const totalMin = h * 60 + m
  const startMin = 8 * 60
  return Math.floor((totalMin - startMin) / 30)
}

export function WeekView() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [blockingDay, setBlockingDay] = useState<Date | null>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true)
      try {
        const from = format(currentWeekStart, 'yyyy-MM-dd') + 'T00:00:00'
        const to = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd') + 'T23:59:59'
        const params = new URLSearchParams({ from, to, page: '1' })
        const res = await fetch(`/api/appointments?${params}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setAppointments(data.appointments || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAppointments()
  }, [currentWeekStart])

  const getAppointmentsForDayAndSlot = (day: Date, slotIndex: number): Appointment[] => {
    return appointments.filter(appt => {
      const apptDate = parseISO(appt.starts_at)
      return isSameDay(apptDate, day) && apptToSlotIndex(appt.starts_at) === slotIndex
    })
  }

  const blockDay = async (day: Date) => {
    setBlockingDay(day)
    try {
      const res = await fetch('/api/schedule/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(day, 'yyyy-MM-dd'),
          type: 'closed',
        }),
      })
      if (!res.ok) throw new Error('Failed to block day')
      alert(`${format(day, 'dd MMM', { locale: bg })} е блокиран`)
    } catch (err) {
      console.error(err)
      alert('Грешка при блокиране на деня')
    } finally {
      setBlockingDay(null)
    }
  }

  const prevWeek = () => setCurrentWeekStart(d => subWeeks(d, 1))
  const nextWeek = () => setCurrentWeekStart(d => addWeeks(d, 1))
  const goToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            Днес
          </Button>
        </div>
        <p className="text-sm font-medium">
          {format(currentWeekStart, 'dd MMM', { locale: bg })} –{' '}
          {format(addDays(currentWeekStart, 6), 'dd MMM yyyy', { locale: bg })}
        </p>
      </div>

      {/* Selected appointment detail */}
      {selected && (
        <div className="rounded-lg border border-border bg-card p-4 flex items-start justify-between">
          <div>
            <p className="font-semibold">{selected.patient_name}</p>
            <p className="text-sm text-muted-foreground">{selected.service}</p>
            <p className="text-sm text-muted-foreground">{selected.patient_phone}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(parseISO(selected.starts_at), 'dd MMM HH:mm', { locale: bg })}
              {selected.ends_at && ` – ${format(parseISO(selected.ends_at), 'HH:mm')}`}
            </p>
            {selected.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">{selected.notes}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>×</Button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="rounded-lg border border-border overflow-auto">
        <div className="min-w-[700px]">
          {/* Header row */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border sticky top-0 bg-background z-10">
            <div className="p-2" />
            {weekDays.map(day => (
              <div key={day.toISOString()} className="p-2 text-center border-l border-border">
                <p className="text-xs text-muted-foreground capitalize">
                  {format(day, 'EEE', { locale: bg })}
                </p>
                <p className={`text-sm font-semibold ${isSameDay(day, new Date()) ? 'text-primary' : ''}`}>
                  {format(day, 'dd')}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1 text-xs text-muted-foreground hover:text-red-400 mt-1 w-full"
                  onClick={() => blockDay(day)}
                  disabled={blockingDay !== null}
                >
                  <Lock className="h-3 w-3 mr-1" />
                  Блокирай
                </Button>
              </div>
            ))}
          </div>

          {/* Time slots */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Зареждане...
            </div>
          ) : (
            TIME_SLOTS.map((slot, slotIndex) => (
              <div
                key={slot}
                className={`grid grid-cols-[60px_repeat(7,1fr)] ${slotIndex % 2 === 0 ? 'border-t border-border' : 'border-t border-border/30'}`}
              >
                <div className="p-1 text-xs text-muted-foreground text-right pr-2 pt-1 leading-none">
                  {slotIndex % 2 === 0 ? slot : ''}
                </div>
                {weekDays.map(day => {
                  const dayAppts = getAppointmentsForDayAndSlot(day, slotIndex)
                  return (
                    <div
                      key={day.toISOString()}
                      className="border-l border-border min-h-[28px] p-0.5 relative"
                    >
                      {dayAppts.map(appt => (
                        <button
                          key={appt.id}
                          className={`w-full text-left rounded px-1 py-0.5 text-xs border cursor-pointer transition-opacity hover:opacity-80 ${STATUS_COLORS[appt.status] || 'bg-gray-500/50 border-gray-400 text-white'}`}
                          onClick={() => setSelected(appt === selected ? null : appt)}
                        >
                          <p className="font-medium truncate leading-tight">{appt.patient_name}</p>
                          <p className="truncate opacity-80 leading-tight">{appt.service}</p>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
