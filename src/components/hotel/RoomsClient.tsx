'use client'

import { useState } from 'react'
import { RoomForm } from './RoomForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RoomRow } from '@/types/database'

interface RoomsClientProps {
  initialRooms: RoomRow[]
}

const typeLabels: Record<string, string> = {
  single: 'Единична',
  double: 'Двойна',
  suite: 'Апартамент',
  apartment: 'Студио',
}

export function RoomsClient({ initialRooms }: RoomsClientProps) {
  const [rooms, setRooms] = useState<RoomRow[]>(initialRooms)
  const [showForm, setShowForm] = useState(false)
  const [editRoom, setEditRoom] = useState<RoomRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchRooms() {
    const res = await fetch('/api/hotel/rooms')
    if (res.ok) {
      const data = await res.json()
      setRooms(data)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Сигурни ли сте?')) return
    setDeletingId(id)
    await fetch(`/api/hotel/rooms/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    await fetchRooms()
  }

  function handleSuccess() {
    setShowForm(false)
    setEditRoom(null)
    fetchRooms()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Стаи</h1>
        <Button onClick={() => { setEditRoom(null); setShowForm(true) }}>Добави стая</Button>
      </div>

      {(showForm && !editRoom) && (
        <Card>
          <CardHeader><CardTitle>Нова стая</CardTitle></CardHeader>
          <CardContent>
            <RoomForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map(room => (
          <Card key={room.id}>
            {editRoom?.id === room.id ? (
              <>
                <CardHeader><CardTitle>Редактиране</CardTitle></CardHeader>
                <CardContent>
                  <RoomForm
                    room={editRoom}
                    onSuccess={handleSuccess}
                    onCancel={() => setEditRoom(null)}
                  />
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{room.name}</CardTitle>
                    <Badge variant="secondary">{typeLabels[room.type] ?? room.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{room.capacity} гости · {room.base_price} EUR/нощ</p>
                  {room.ical_url && (
                    <p className="text-xs text-muted-foreground truncate">iCal: {room.ical_url}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => setEditRoom(room)}>Редактирай</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(room.id)} disabled={deletingId === room.id}>Изтрий</Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>

      {rooms.length === 0 && !showForm && (
        <p className="text-muted-foreground text-center py-12">Няма добавени стаи.</p>
      )}
    </div>
  )
}
