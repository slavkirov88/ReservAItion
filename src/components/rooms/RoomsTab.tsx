'use client'
import { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import type { RoomRow, RoomTypeRow } from '@/types/database'

interface Props {
  rooms: RoomRow[]
  roomTypes: RoomTypeRow[]
  onRefresh: () => void
}

const statusColors: Record<string, string> = {
  free: 'bg-green-500/10 text-green-400 border-green-500/30',
  occupied: 'bg-red-500/10 text-red-400 border-red-500/30',
  cleaning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  maintenance: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

const statusLabels: Record<string, string> = {
  free: 'Свободна',
  occupied: 'Заета',
  cleaning: 'Почистване',
  maintenance: 'Ремонт',
}

export function RoomsTab({ rooms, roomTypes, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ room_number: string; name: string; room_type_id: string | null }>({ room_number: '', name: '', room_type_id: null })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'room',
        room_number: form.room_number || null,
        name: form.name || null,
        room_type_id: form.room_type_id,
      }),
    })
    setSaving(false)
    setOpen(false)
    setForm({ room_number: '', name: '', room_type_id: null })
    onRefresh()
  }

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'rooms', status }),
    })
    onRefresh()
  }

  if (roomTypes.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-12">Добавете типове стаи първо, след това добавете конкретни стаи.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Добави стая</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Нова стая</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Тип стая *</Label>
                <Select value={form.room_type_id} onValueChange={v => setForm(f => ({ ...f, room_type_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Изберете тип" /></SelectTrigger>
                  <SelectContent>
                    {roomTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Номер (по избор)</Label>
                  <Input value={form.room_number} onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))} placeholder="101" />
                </div>
                <div className="space-y-2">
                  <Label>Име (по избор)</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Морска стая" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving || !form.room_type_id} className="w-full">
                {saving ? 'Запазване...' : 'Запази'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rooms.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">Няма добавени стаи.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Стая</TableHead>
                <TableHead className="text-muted-foreground">Тип</TableHead>
                <TableHead className="text-muted-foreground">Статус</TableHead>
                <TableHead className="text-muted-foreground">Промени статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map(room => {
                const roomType = roomTypes.find(rt => rt.id === room.room_type_id)
                return (
                  <TableRow key={room.id} className="border-border">
                    <TableCell className="font-medium">
                      {room.room_number ? `Стая ${room.room_number}` : room.name || '—'}
                      {room.room_number && room.name && <span className="text-xs text-muted-foreground ml-2">{room.name || ''}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{roomType?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[room.status]}>
                        {statusLabels[room.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={room.status} onValueChange={v => handleStatusChange(room.id, v ?? '')}>
                        <SelectTrigger className="w-36 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Свободна</SelectItem>
                          <SelectItem value="occupied">Заета</SelectItem>
                          <SelectItem value="cleaning">Почистване</SelectItem>
                          <SelectItem value="maintenance">Ремонт</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
