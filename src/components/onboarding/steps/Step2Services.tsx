'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

interface RoomType {
  name: string
  capacity: number
  price_per_night: number
}

interface Props {
  roomTypes: RoomType[]
  onChange: (roomTypes: RoomType[]) => void
}

export function Step2RoomTypes({ roomTypes, onChange }: Props) {
  function addRoomType() {
    onChange([...roomTypes, { name: '', capacity: 2, price_per_night: 0 }])
  }

  function removeRoomType(index: number) {
    onChange(roomTypes.filter((_, i) => i !== index))
  }

  function updateRoomType(index: number, field: keyof RoomType, value: string) {
    const updated = roomTypes.map((rt, i) => {
      if (i !== index) return rt
      if (field === 'name') return { ...rt, name: value }
      return { ...rt, [field]: Number(value) }
    })
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Добавете типовете стаи, които предлагате. AI ще ги предлага при резервации.
      </p>

      {roomTypes.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">Тип стая</div>
            <div className="col-span-3">Капацитет</div>
            <div className="col-span-3">Цена/нощ (€)</div>
            <div className="col-span-1" />
          </div>
          {roomTypes.map((rt, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Input
                  value={rt.name}
                  onChange={e => updateRoomType(i, 'name', e.target.value)}
                  placeholder="Стандартна, Делукс..."
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  value={rt.capacity}
                  onChange={e => updateRoomType(i, 'capacity', e.target.value)}
                  min={1}
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  value={rt.price_per_night}
                  onChange={e => updateRoomType(i, 'price_per_night', e.target.value)}
                  min={0}
                />
              </div>
              <div className="col-span-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRoomType(i)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={addRoomType} className="gap-2">
        <Plus className="h-4 w-4" />
        Добави тип стая
      </Button>
    </div>
  )
}
