'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Room {
  id: string
  name: string
  ical_url?: string | null
}

interface HotelStep3iCalProps {
  onNext: () => void
  onBack: () => void
}

export function HotelStep3iCal({ onNext, onBack }: HotelStep3iCalProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [icalUrls, setIcalUrls] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [saveError, setSaveError] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hotel/rooms')
      if (res.ok) {
        const data = await res.json() as Room[]
        setRooms(data)
        const urls: Record<string, string> = {}
        data.forEach(r => { urls[r.id] = r.ical_url ?? '' })
        setIcalUrls(urls)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRooms()
  }, [fetchRooms])

  async function saveIcal(roomId: string) {
    setSaving(prev => ({ ...prev, [roomId]: true }))
    setSaveError(prev => ({ ...prev, [roomId]: '' }))
    try {
      const response = await fetch(`/api/hotel/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ical_url: icalUrls[roomId] || null }),
      })
      if (!response.ok) {
        const json = await response.json().catch(() => ({ error: 'Unknown error' }))
        setSaveError(prev => ({ ...prev, [roomId]: (json as { error?: string }).error ?? 'Грешка при запазване' }))
      } else {
        setSaved(prev => ({ ...prev, [roomId]: true }))
        setTimeout(() => setSaved(prev => ({ ...prev, [roomId]: false })), 2000)
      }
    } finally {
      setSaving(prev => ({ ...prev, [roomId]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Въведете iCal URL от Booking.com, Airbnb или друга платформа за всяка стая.
        Тази стъпка е незадължителна.
      </p>
      {loading ? (
        <p className="text-muted-foreground text-sm">Зареждане...</p>
      ) : rooms.length === 0 ? (
        <p className="text-muted-foreground text-sm">Няма добавени стаи.</p>
      ) : (
        <div className="space-y-4">
          {rooms.map(room => (
            <div key={room.id} className="space-y-2">
              <Label>{room.name}</Label>
              <div className="flex gap-2">
                <Input
                  value={icalUrls[room.id] ?? ''}
                  onChange={e => setIcalUrls(prev => ({ ...prev, [room.id]: e.target.value }))}
                  placeholder="https://..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => void saveIcal(room.id)}
                  disabled={saving[room.id]}
                >
                  {saved[room.id] ? 'Запазено ✓' : saving[room.id] ? 'Запазване...' : 'Запази'}
                </Button>
              </div>
              {saveError[room.id] && (
                <p className="text-destructive text-sm">{saveError[room.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>Назад</Button>
        <Button onClick={onNext}>Напред</Button>
      </div>
    </div>
  )
}
