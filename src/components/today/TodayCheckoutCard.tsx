'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import type { ReservationRow } from '@/types/database'

interface Props {
  reservation: ReservationRow
  onCheckedOut: () => void
}

export function TodayCheckoutCard({ reservation, onCheckedOut }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    if (!res.ok) {
      setSaving(false)
      setError('Грешка при освобождаване. Опитайте отново.')
      return
    }
    if (reservation.room_id) {
      await fetch(`/api/rooms/${reservation.room_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'rooms', status: 'cleaning' }),
      })
    }
    setSaving(false)
    onCheckedOut()
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
      <div>
        <p className="font-medium text-sm">{reservation.guest_name}</p>
        <p className="text-xs text-muted-foreground">{reservation.guest_phone}</p>
        <p className="text-xs text-muted-foreground">
          от {format(new Date(reservation.check_in_date), 'dd MMM', { locale: bg })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button size="sm" variant="outline" onClick={handleCheckout} disabled={saving}>
          {saving ? '...' : 'Освободи стая'}
        </Button>
      </div>
    </div>
  )
}
