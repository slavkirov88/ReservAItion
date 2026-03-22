'use client'
import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RoomTypesTab } from '@/components/rooms/RoomTypesTab'
import { RoomsTab } from '@/components/rooms/RoomsTab'
import type { RoomTypeRow, RoomRow } from '@/types/database'

export default function RoomsPage() {
  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([])
  const [rooms, setRooms] = useState<RoomRow[]>([])

  const fetchRooms = useCallback(async () => {
    const res = await fetch('/api/rooms')
    if (!res.ok) return
    const data = await res.json()
    setRoomTypes(data.roomTypes || [])
    setRooms(data.rooms || [])
  }, [])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Стаи</h1>
        <p className="text-muted-foreground">Управлявайте типовете и конкретните стаи</p>
      </div>
      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">Типове стаи</TabsTrigger>
          <TabsTrigger value="rooms">Стаи</TabsTrigger>
        </TabsList>
        <TabsContent value="types" className="mt-4">
          <RoomTypesTab roomTypes={roomTypes} onRefresh={fetchRooms} />
        </TabsContent>
        <TabsContent value="rooms" className="mt-4">
          <RoomsTab rooms={rooms} roomTypes={roomTypes} onRefresh={fetchRooms} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
