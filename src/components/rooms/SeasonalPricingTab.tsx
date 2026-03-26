'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { RoomTypeRow, SeasonalPricingRow } from '@/types/database'

interface Props {
  roomTypes: RoomTypeRow[]
}

const EMPTY_FORM = { label: '', start_date: '', end_date: '', price_per_night: '' }

export function SeasonalPricingTab({ roomTypes }: Props) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [seasons, setSeasons] = useState<SeasonalPricingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<SeasonalPricingRow | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (roomTypes.length > 0 && !selectedTypeId) {
      setSelectedTypeId(roomTypes[0].id)
    }
  }, [roomTypes, selectedTypeId])

  const fetchSeasons = useCallback(async (roomTypeId: string) => {
    if (!roomTypeId) return
    setLoading(true)
    const res = await fetch(`/api/seasonal-pricing?room_type_id=${roomTypeId}`)
    setLoading(false)
    if (!res.ok) return
    setSeasons(await res.json())
  }, [])

  useEffect(() => {
    if (selectedTypeId) fetchSeasons(selectedTypeId)
  }, [selectedTypeId, fetchSeasons])

  const handleAdd = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/seasonal-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_type_id: selectedTypeId,
        label: form.label,
        start_date: form.start_date,
        end_date: form.end_date,
        price_per_night: parseFloat(form.price_per_night),
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
    fetchSeasons(selectedTypeId)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Изтрий този сезон?')) return
    const res = await fetch(`/api/seasonal-pricing/${id}`, { method: 'DELETE' })
    if (!res.ok) { setError('Грешка при изтриване'); return }
    fetchSeasons(selectedTypeId)
  }

  const openEdit = (s: SeasonalPricingRow) => {
    setEditTarget(s)
    setEditForm({
      label: s.label,
      start_date: s.start_date,
      end_date: s.end_date,
      price_per_night: String(s.price_per_night),
    })
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/seasonal-pricing/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: editForm.label,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        price_per_night: parseFloat(editForm.price_per_night),
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('Грешка при редактиране'); return }
    setEditTarget(null)
    fetchSeasons(selectedTypeId)
  }

  const selectedType = roomTypes.find(rt => rt.id === selectedTypeId)

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {roomTypes.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">
          Първо добавете типове стаи.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {roomTypes.map(rt => (
              <button
                key={rt.id}
                onClick={() => setSelectedTypeId(rt.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedTypeId === rt.id
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {rt.name}
              </button>
            ))}
          </div>

          {selectedType && (
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-2 bg-muted/30">
              <span className="text-sm text-muted-foreground">Базова цена (извън сезоните)</span>
              <span className="font-semibold text-sm">{selectedType.price_per_night} € / нощ</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Добави сезон
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Зареждане...</p>
          ) : seasons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Няма сезонни цени. Добавете първия сезон.
            </p>
          ) : (
            <div className="space-y-2">
              {seasons.map(s => (
                <Card key={s.id} className="border-border">
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{s.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.start_date} – {s.end_date}
                      </p>
                    </div>
                    <span className="font-bold text-primary">{s.price_per_night} €/нощ</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Нов сезон</DialogTitle></DialogHeader>
          <SeasonForm form={form} setForm={setForm} saving={saving} onSave={handleAdd} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Редактирай сезон</DialogTitle></DialogHeader>
          <SeasonForm form={editForm} setForm={setEditForm} saving={saving} onSave={handleEdit} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SeasonForm({
  form,
  setForm,
  saving,
  onSave,
}: {
  form: typeof EMPTY_FORM
  setForm: (f: typeof EMPTY_FORM) => void
  saving: boolean
  onSave: () => void
}) {
  const valid = form.label && form.start_date && form.end_date && form.price_per_night && form.end_date >= form.start_date
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Наименование *</Label>
        <Input
          value={form.label}
          onChange={e => setForm({ ...form, label: e.target.value })}
          placeholder="Летен сезон, Зимни празници..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>От дата *</Label>
          <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>До дата *</Label>
          <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Цена/нощ (€) *</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.price_per_night}
          onChange={e => setForm({ ...form, price_per_night: e.target.value })}
          placeholder="120.00"
        />
      </div>
      <Button onClick={onSave} disabled={saving || !valid} className="w-full">
        {saving ? 'Запазване...' : 'Запази'}
      </Button>
    </div>
  )
}
