'use client'
import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { bg } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { XIcon } from 'lucide-react'

interface ScheduleOverride {
  id: string
  date: string
  override_type: 'closed' | 'custom'
  note: string | null
}

export function CalendarOverrides() {
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [overrideType, setOverrideType] = useState<'closed' | 'custom'>('closed')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadOverrides() {
    try {
      const res = await fetch('/api/schedule/overrides')
      const data = await res.json()
      if (Array.isArray(data)) {
        setOverrides(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOverrides()
  }, [])

  function handleDayClick(date: Date | undefined) {
    if (!date) return
    setSelectedDate(date)
    setOverrideType('closed')
    setNote('')
    setMessage(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!selectedDate) return
    setSaving(true)
    setMessage(null)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const res = await fetch('/api/schedule/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          override_type: overrideType,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Грешка при запазване' })
      } else {
        setDialogOpen(false)
        await loadOverrides()
      }
    } catch {
      setMessage({ type: 'error', text: 'Мрежова грешка. Опитайте отново.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(date: string) {
    try {
      await fetch(`/api/schedule/overrides?date=${encodeURIComponent(date)}`, { method: 'DELETE' })
      await loadOverrides()
    } catch {
      // ignore
    }
  }

  // Dates that have overrides — used to mark them on the calendar
  const overrideDates = overrides.map(o => parseISO(o.date))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Изключения в графика</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Calendar */}
          <div className="flex-shrink-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDayClick}
              modifiers={{ override: overrideDates }}
              modifiersClassNames={{
                override: 'bg-primary/20 text-primary font-semibold',
              }}
              disabled={{ before: new Date() }}
            />
          </div>

          {/* Override list */}
          <div className="flex-1">
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Предстоящи изключения</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Зареждане...</p>
            ) : overrides.length === 0 ? (
              <p className="text-sm text-muted-foreground">Няма изключения. Щракнете върху дата в календара, за да добавите.</p>
            ) : (
              <ul className="space-y-2">
                {overrides.map(o => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {format(parseISO(o.date), 'dd MMM yyyy', { locale: bg })}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {o.override_type === 'closed' ? '— Почивен ден' : '— Персонализиран'}
                      </span>
                      {o.note && (
                        <span className="ml-2 text-muted-foreground italic">{o.note}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(o.date)}
                      className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Изтрий"
                    >
                      <XIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedDate
                  ? `Изключение за ${format(selectedDate, 'dd MMMM yyyy', { locale: bg })}`
                  : 'Добави изключение'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Тип</Label>
                <Select
                  value={overrideType}
                  onValueChange={val => setOverrideType(val as 'closed' | 'custom')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">Почивен ден (затворено)</SelectItem>
                    <SelectItem value="custom">Персонализиран</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Бележка (незадължително)</Label>
                <Input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="напр. Национален празник"
                />
              </div>

              {message && (
                <div
                  className={`rounded-md px-3 py-2 text-sm ${
                    message.type === 'success'
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Отказ
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Запазване...' : 'Запази'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
