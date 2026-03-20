'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface RoomFormProps {
  room?: { id: string; name: string; type: string; capacity: number; base_price: number; ical_url?: string | null }
  onSuccess: () => void
  onCancel: () => void
}

export function RoomForm({ room, onSuccess, onCancel }: RoomFormProps) {
  const [name, setName] = useState(room?.name ?? '')
  const [type, setType] = useState(room?.type ?? 'double')
  const [capacity, setCapacity] = useState(room?.capacity ?? 2)
  const [basePrice, setBasePrice] = useState(room?.base_price ?? 0)
  const [icalUrl, setIcalUrl] = useState(room?.ical_url ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const body = { name, type, capacity, base_price: basePrice, ical_url: icalUrl || null }
    const url = room ? `/api/hotel/rooms/${room.id}` : '/api/hotel/rooms'
    const method = room ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setLoading(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      alert(err.error ?? 'Грешка при запазване')
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Наименование</Label>
        <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div>
        <Label>Тип</Label>
        <Select value={type} onValueChange={(v) => { if (v) setType(v) }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Единична</SelectItem>
            <SelectItem value="double">Двойна</SelectItem>
            <SelectItem value="suite">Апартамент</SelectItem>
            <SelectItem value="apartment">Студио</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="capacity">Капацитет (гости)</Label>
        <Input id="capacity" type="number" min={1} value={capacity} onChange={e => setCapacity(Number(e.target.value))} required />
      </div>
      <div>
        <Label htmlFor="price">Цена на нощ (EUR)</Label>
        <Input id="price" type="number" min={0} step="0.01" value={basePrice} onChange={e => setBasePrice(Number(e.target.value))} required />
      </div>
      <div>
        <Label htmlFor="ical">iCal URL (Booking.com / Airbnb)</Label>
        <Input id="ical" value={icalUrl} onChange={e => setIcalUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>{loading ? 'Запазване...' : 'Запази'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Отказ</Button>
      </div>
    </form>
  )
}
