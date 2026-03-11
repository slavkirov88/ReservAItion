'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

interface Service {
  name: string
  duration_min: number
  price: number
}

interface Props {
  services: Service[]
  onChange: (services: Service[]) => void
}

export function Step2Services({ services, onChange }: Props) {
  function addService() {
    onChange([...services, { name: '', duration_min: 30, price: 0 }])
  }

  function removeService(index: number) {
    onChange(services.filter((_, i) => i !== index))
  }

  function updateService(index: number, field: keyof Service, value: string) {
    const updated = services.map((s, i) => {
      if (i !== index) return s
      if (field === 'name') return { ...s, name: value }
      return { ...s, [field]: Number(value) }
    })
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Добавете услугите, които предлагате. AI ще ги предлага при записване на часове.
      </p>

      {services.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">Услуга</div>
            <div className="col-span-3">Мин.</div>
            <div className="col-span-3">Цена (лв)</div>
            <div className="col-span-1" />
          </div>
          {services.map((service, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Input
                  value={service.name}
                  onChange={e => updateService(i, 'name', e.target.value)}
                  placeholder="Преглед"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  value={service.duration_min}
                  onChange={e => updateService(i, 'duration_min', e.target.value)}
                  min={5}
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  value={service.price}
                  onChange={e => updateService(i, 'price', e.target.value)}
                  min={0}
                />
              </div>
              <div className="col-span-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeService(i)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={addService} className="gap-2">
        <Plus className="h-4 w-4" />
        Добави услуга
      </Button>
    </div>
  )
}
