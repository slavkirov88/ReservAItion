'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { RoomForm } from '@/components/hotel/RoomForm'

interface Room {
  id: string
  name: string
  type: string
  capacity: number
  base_price: number
  ical_url?: string | null
}

interface HotelStep2RoomsProps {
  onNext: () => void
  onBack: () => void
}

export function HotelStep2Rooms({ onNext, onBack }: HotelStep2RoomsProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hotel/rooms')
      if (res.ok) {
        const data = await res.json() as Room[]
        setRooms(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRooms()
  }, [fetchRooms])

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-muted-foreground text-sm">Зареждане...</p>
      ) : (
        <>
          {rooms.length > 0 && (
            <ul className="space-y-2">
              {rooms.map(room => (
                <li key={room.id} className="flex items-center justify-between rounded-lg border px-4 py-2">
                  <div>
                    <p className="font-medium">{room.name}</p>
                    <p className="text-sm text-muted-foreground">{room.type} · {room.capacity} гости · {room.base_price} EUR/нощ</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showForm ? (
            <RoomForm
              onSuccess={() => { setShowForm(false); void fetchRooms() }}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <Button variant="outline" onClick={() => setShowForm(true)}>
              + Добави стая
            </Button>
          )}
        </>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>Назад</Button>
        <Button onClick={onNext} disabled={rooms.length === 0}>
          Напред
        </Button>
      </div>
    </div>
  )
}
