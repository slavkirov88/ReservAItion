'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'

interface RoomType {
  id?: string
  name: string
  capacity: number
  price_per_night: number
}

export function ServicesEditor() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/services')
      .then(r => r.json())
      .then((d: { roomTypes?: RoomType[] }) => {
        setRoomTypes(d.roomTypes || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function addRoomType() {
    setRoomTypes(s => [...s, { name: '', capacity: 2, price_per_night: 0 }])
  }

  function removeRoomType(i: number) {
    setRoomTypes(s => s.filter((_, idx) => idx !== i))
  }

  function updateRoomType(i: number, field: keyof RoomType, value: string | number) {
    setRoomTypes(s => s.map((rt, idx) => idx === i ? { ...rt, [field]: value } : rt))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      for (const rt of roomTypes) {
        if (!rt.name) continue
        const method = rt.id ? 'PUT' : 'POST'
        const url = rt.id ? `/api/settings/services` : '/api/settings/services'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rt.id ? { id: rt.id, name: rt.name, capacity: rt.capacity, price_per_night: rt.price_per_night } : { name: rt.name, capacity: rt.capacity, price_per_night: rt.price_per_night }),
        })
        if (!res.ok) throw new Error('Грешка при запазване')
      }
      setMessage({ type: 'success', text: 'Типовете стаи са запазени!' })
      // Refresh
      const res = await fetch('/api/settings/services')
      const d = await res.json()
      setRoomTypes(d.roomTypes || [])
    } catch {
      setMessage({ type: 'error', text: 'Грешка при запазване' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Зареждане...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Типове стаи</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {roomTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">Няма добавени типове стаи.</p>
          )}
          {roomTypes.length > 0 && (
            <div className="grid grid-cols-[1fr_100px_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
              <span>Тип стая</span>
              <span>Капацитет</span>
              <span>Цена/нощ (лв)</span>
            </div>
          )}
          {roomTypes.map((rt, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_120px_40px] gap-2 items-center">
              <Input
                placeholder="Стандартна, Делукс..."
                value={rt.name}
                onChange={e => updateRoomType(i, 'name', e.target.value)}
              />
              <Input
                type="number"
                placeholder="2"
                min={1}
                value={rt.capacity}
                onChange={e => updateRoomType(i, 'capacity', parseInt(e.target.value) || 2)}
              />
              <Input
                type="number"
                placeholder="120.00"
                min={0}
                step={0.01}
                value={rt.price_per_night}
                onChange={e => updateRoomType(i, 'price_per_night', parseFloat(e.target.value) || 0)}
              />
              <Button variant="ghost" size="icon" onClick={() => removeRoomType(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addRoomType}>
          <Plus className="h-4 w-4 mr-2" />
          Добави тип стая
        </Button>
        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Запазване...' : 'Запази'}
        </Button>
      </CardContent>
    </Card>
  )
}
