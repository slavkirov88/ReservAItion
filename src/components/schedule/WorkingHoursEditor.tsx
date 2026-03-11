'use client'
import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const DAYS = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота']

interface ScheduleRule {
  day_of_week: number
  is_active: boolean
  start_time: string
  end_time: string
  slot_duration_min: number
  break_start: string
  break_end: string
}

const DEFAULT_RULES: ScheduleRule[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  is_active: i >= 1 && i <= 5,
  start_time: '09:00',
  end_time: '18:00',
  slot_duration_min: 30,
  break_start: '13:00',
  break_end: '14:00',
}))

export function WorkingHoursEditor() {
  const [rules, setRules] = useState<ScheduleRule[]>(DEFAULT_RULES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/schedule/rules')
      .then(res => res.json())
      .then((data: ScheduleRule[]) => {
        if (Array.isArray(data) && data.length > 0) {
          // Merge fetched data with defaults for any missing days
          const merged = DEFAULT_RULES.map(def => {
            const fetched = data.find(r => r.day_of_week === def.day_of_week)
            return fetched ? { ...def, ...fetched } : def
          })
          setRules(merged)
        }
      })
      .catch(() => {
        // Keep defaults on error
      })
      .finally(() => setLoading(false))
  }, [])

  function updateRule(dayOfWeek: number, updates: Partial<ScheduleRule>) {
    setRules(prev => prev.map(r => r.day_of_week === dayOfWeek ? { ...r, ...updates } : r))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/schedule/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      })
      if (!res.ok) {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Грешка при запазване' })
      } else {
        setMessage({ type: 'success', text: 'Работното време е запазено успешно.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Мрежова грешка. Опитайте отново.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Седмичен график</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">Зареждане...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Седмичен график</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-32">Ден</th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-16">Активен</th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-28">Начало</th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-28">Край</th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-32">Интервал</th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-28">Обедна почивка от</th>
                <th className="text-left py-2 font-medium text-muted-foreground w-28">До</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.day_of_week} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-4">
                    <Label className="font-medium">{DAYS[rule.day_of_week]}</Label>
                  </td>
                  <td className="py-3 pr-4">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={checked => updateRule(rule.day_of_week, { is_active: checked })}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      type="time"
                      value={rule.start_time}
                      disabled={!rule.is_active}
                      onChange={e => updateRule(rule.day_of_week, { start_time: e.target.value })}
                      className="w-28"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      type="time"
                      value={rule.end_time}
                      disabled={!rule.is_active}
                      onChange={e => updateRule(rule.day_of_week, { end_time: e.target.value })}
                      className="w-28"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Select
                      value={String(rule.slot_duration_min)}
                      disabled={!rule.is_active}
                      onValueChange={val => updateRule(rule.day_of_week, { slot_duration_min: Number(val) })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 мин</SelectItem>
                        <SelectItem value="30">30 мин</SelectItem>
                        <SelectItem value="60">60 мин</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      type="time"
                      value={rule.break_start}
                      disabled={!rule.is_active}
                      onChange={e => updateRule(rule.day_of_week, { break_start: e.target.value })}
                      className="w-28"
                    />
                  </td>
                  <td className="py-3">
                    <Input
                      type="time"
                      value={rule.break_end}
                      disabled={!rule.is_active}
                      onChange={e => updateRule(rule.day_of_week, { break_end: e.target.value })}
                      className="w-28"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-md px-4 py-2 text-sm ${
              message.type === 'success'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Запазване...' : 'Запази'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
