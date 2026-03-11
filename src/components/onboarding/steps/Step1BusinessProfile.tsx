'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Step1Data {
  businessName: string
  slug: string
  phone: string
  address: string
}

interface Props {
  data: Step1Data
  onChange: (data: Step1Data) => void
}

export function Step1BusinessProfile({ data, onChange }: Props) {
  function handleNameChange(businessName: string) {
    const slug = businessName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    onChange({ ...data, businessName, slug })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="businessName">Име на бизнеса *</Label>
        <Input
          id="businessName"
          value={data.businessName}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Дентален Център Иванов"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">URL идентификатор</Label>
        <Input
          id="slug"
          value={data.slug}
          onChange={e => onChange({ ...data, slug: e.target.value })}
          placeholder="dentalen-centyr-ivanov"
        />
        <p className="text-xs text-muted-foreground">Автоматично генериран от името</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Телефон</Label>
        <Input
          id="phone"
          value={data.phone}
          onChange={e => onChange({ ...data, phone: e.target.value })}
          placeholder="+359 88 123 4567"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Адрес</Label>
        <Input
          id="address"
          value={data.address}
          onChange={e => onChange({ ...data, address: e.target.value })}
          placeholder="ул. Витоша 15, София"
        />
      </div>
    </div>
  )
}
