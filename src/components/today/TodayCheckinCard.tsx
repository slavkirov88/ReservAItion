'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ReservationRow, RoomRow } from '@/types/database'

interface Props {
  reservation: ReservationRow
  availableRooms: RoomRow[]
  onCheckedIn: () => void
}

export function TodayCheckinCard({ reservation, availableRooms, onCheckedIn }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCheckin = async () => {
    setSaving(true)
    await fetch(`/api/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: selectedRoom, status: 'confirmed' }),
    })
    if (selectedRoom) {
      await fetch(`/api/rooms/${selectedRoom}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'rooms', status: 'occupied' }),
      })
    }
    setSaving(false)
    setOpen(false)
    onCheckedIn()
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
      <div>
        <p className="font-medium text-sm">{reservation.guest_name}</p>
        <p className="text-xs text-muted-foreground">{reservation.guest_phone}</p>
        {reservation.check_out_date && (
          <p className="text-xs text-muted-foreground">
            до {format(new Date(reservation.check_out_date), 'dd MMM', { locale: bg })}
          </p>
        )}
      </div>
      <Button size="sm" onClick={() => setOpen(true)}>Настани</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Настани {reservation.guest_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {availableRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Няма свободни стаи. Назначете стая след освобождаване.</p>
            ) : (
              <Select value={selectedRoom} onValueChange={(v) => setSelectedRoom(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Изберете стая" /></SelectTrigger>
                <SelectContent>
                  {availableRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.room_number ? `Стая ${r.room_number}` : r.name || r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Отказ</Button>
              <Button onClick={handleCheckin} disabled={saving || !selectedRoom}>
                {saving ? 'Запазване...' : 'Потвърди'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
