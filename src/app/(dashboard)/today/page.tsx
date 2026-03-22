'use client'
import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TodayCheckinCard } from '@/components/today/TodayCheckinCard'
import { TodayCheckoutCard } from '@/components/today/TodayCheckoutCard'
import type { ReservationRow, RoomRow } from '@/types/database'

export default function TodayPage() {
  const [checkins, setCheckins] = useState<ReservationRow[]>([])
  const [checkouts, setCheckouts] = useState<ReservationRow[]>([])
  const [freeRooms, setFreeRooms] = useState<RoomRow[]>([])

  const fetchData = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd')

    const [resRes, roomRes] = await Promise.all([
      fetch(`/api/reservations?from=${today}T00:00:00&to=${today}T23:59:59&status=confirmed`),
      fetch('/api/rooms'),
    ])

    if (resRes.ok) {
      const data = await resRes.json()
      const all: ReservationRow[] = data.reservations || []
      setCheckins(all.filter(r => r.check_in_date.startsWith(today)))
      setCheckouts(all.filter(r => r.check_out_date?.startsWith(today)))
    }

    if (roomRes.ok) {
      const data = await roomRes.json()
      setFreeRooms((data.rooms || []).filter((r: RoomRow) => r.status === 'free'))
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const todayLabel = format(new Date(), 'dd MMMM yyyy', { locale: bg })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Днес</h1>
        <p className="text-muted-foreground">{todayLabel}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-green-400">↓</span> Пристигащи ({checkins.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkins.length === 0 ? (
              <p className="text-muted-foreground text-sm">Няма пристигащи днес</p>
            ) : (
              <div className="space-y-3">
                {checkins.map(r => (
                  <TodayCheckinCard key={r.id} reservation={r} availableRooms={freeRooms} onCheckedIn={fetchData} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-blue-400">↑</span> Напускащи ({checkouts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkouts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Няма напускащи днес</p>
            ) : (
              <div className="space-y-3">
                {checkouts.map(r => (
                  <TodayCheckoutCard key={r.id} reservation={r} onCheckedOut={fetchData} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
