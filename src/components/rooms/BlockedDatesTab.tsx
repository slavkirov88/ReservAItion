'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2, Ban } from 'lucide-react'
import type { RoomTypeRow, BlockedDateRow } from '@/types/database'

interface BlockedDateWithRoom extends BlockedDateRow {
  room_types?: { name: string } | null
}

interface Props {
  roomTypes: RoomTypeRow[]
}

const EMPTY_FORM = { room_type_id: '', start_date: '', end_date: '', reason: '' }

export function BlockedDatesTab({ roomTypes }: Props) {
  const [blocked, setBlocked] = useState<BlockedDateWithRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchBlocked = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/blocked-dates')
    setLoading(false)
    if (!res.ok) return
    setBlocked(await res.json())
  }, [])

  useEffect(() => { fetchBlocked() }, [fetchBlocked])

  const handleAdd = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/blocked-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_type_id: form.room_type_id || null,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Грешка при запазване')
      return
    }
    setAddOpen(false)
    setForm(EMPTY_FORM)
    fetchBlocked()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Премахни блокирането?')) return
    const res = await fetch(`/api/blocked-dates/${id}`, { method: 'DELETE' })
    if (!res.ok) { setError('Грешка при изтриване'); return }
    fetchBlocked()
  }

  const valid = form.start_date && form.end_date && form.end_date >= form.start_date

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground max-w-lg">
          Блокираните дати се включват автоматично в iCal feed-а и се синхронизират с Booking.com, Airbnb и др.
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Блокирай дати
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Зареждане...</p>
      ) : blocked.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Няма блокирани дати.
        </p>
      ) : (
        <div className="space-y-2">
          {blocked.map(b => (
            <Card key={b.id} className="border-border">
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <Ban className="h-4 w-4 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {b.start_date === b.end_date ? b.start_date : `${b.start_date} – ${b.end_date}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.room_types?.name ? b.room_types.name : 'Всички стаи'}
                    {b.reason ? ` · ${b.reason}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(b.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Блокирай дати</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>От дата *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>До дата *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Тип стая</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.room_type_id}
                onChange={e => setForm(f => ({ ...f, room_type_id: e.target.value }))}
              >
                <option value="">Всички стаи</option>
                {roomTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Причина (незадължително)</Label>
              <Input
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Ремонт, лична употреба..."
              />
            </div>
            <Button onClick={handleAdd} disabled={saving || !valid} className="w-full">
              {saving ? 'Запазване...' : 'Блокирай'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
