'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { RoomTypeRow } from '@/types/database'

interface Props {
  roomTypes: RoomTypeRow[]
  onRefresh: () => void
}

export function RoomTypesTab({ roomTypes, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', capacity: '2', price_per_night: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RoomTypeRow | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', capacity: '2', price_per_night: '' })

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'room_type',
        name: form.name,
        description: form.description || null,
        capacity: parseInt(form.capacity),
        price_per_night: parseFloat(form.price_per_night),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Грешка при запазване')
      return
    }
    setOpen(false)
    setForm({ name: '', description: '', capacity: '2', price_per_night: '' })
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Изтрий този тип стая?')) return
    const res = await fetch(`/api/rooms/${id}?table=room_types`, { method: 'DELETE' })
    if (!res.ok) { setError('Грешка при изтриване'); return }
    onRefresh()
  }

  const openEdit = (rt: RoomTypeRow) => {
    setEditTarget(rt)
    setEditForm({
      name: rt.name,
      description: rt.description || '',
      capacity: String(rt.capacity),
      price_per_night: String(rt.price_per_night),
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/rooms/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'room_types',
        name: editForm.name,
        description: editForm.description || null,
        capacity: parseInt(editForm.capacity),
        price_per_night: parseFloat(editForm.price_per_night),
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('Грешка при редактиране'); return }
    setEditOpen(false)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4 mr-2" />Добави тип
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Нов тип стая</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Наименование *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Стандартна, Делукс, Апартамент..." />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Кратко описание на стаята" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Капацитет (гости)</Label>
                  <Input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Цена/нощ (€) *</Label>
                  <Input type="number" min="0" step="0.01" value={form.price_per_night} onChange={e => setForm(f => ({ ...f, price_per_night: e.target.value }))} placeholder="120.00" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.price_per_night} className="w-full">
                {saving ? 'Запазване...' : 'Запази'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {roomTypes.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">Няма добавени типове стаи. Добавете първия тип.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roomTypes.map(rt => (
            <Card key={rt.id} className="border-border">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <CardTitle className="text-base">{rt.name}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rt)}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(rt.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {rt.description && <p className="text-sm text-muted-foreground mb-3">{rt.description}</p>}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">До {rt.capacity} гости</span>
                  <span className="font-semibold">{rt.price_per_night} €/нощ</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Редактирай {editTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Наименование *</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Капацитет</Label>
                <Input type="number" min="1" value={editForm.capacity} onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Цена/нощ (€)</Label>
                <Input type="number" min="0" step="0.01" value={editForm.price_per_night} onChange={e => setEditForm(f => ({ ...f, price_per_night: e.target.value }))} />
              </div>
            </div>
            <Button onClick={handleEdit} disabled={saving || !editForm.name} className="w-full">
              {saving ? 'Запазване...' : 'Запази промените'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
