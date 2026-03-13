'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import type { Service } from '@/types/database'

export function ServicesEditor() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/services')
      .then(r => r.json())
      .then((d: { services?: Service[] }) => {
        setServices(d.services || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function addService() {
    setServices(s => [...s, { name: '', duration_min: 30, price: 0 }])
  }

  function removeService(i: number) {
    setServices(s => s.filter((_, idx) => idx !== i))
  }

  function updateService(i: number, field: keyof Service, value: string | number) {
    setServices(s => s.map((svc, idx) => idx === i ? { ...svc, [field]: value } : svc))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services }),
      })
      if (!res.ok) throw new Error('Грешка при запазване')
      setMessage({ type: 'success', text: 'Услугите са запазени!' })
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
        <CardTitle className="text-base">Услуги</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">Няма добавени услуги.</p>
          )}
          {services.map((svc, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_100px_40px] gap-2 items-center">
              <Input
                placeholder="Наименование"
                value={svc.name}
                onChange={e => updateService(i, 'name', e.target.value)}
              />
              <Input
                type="number"
                placeholder="Мин."
                value={svc.duration_min}
                onChange={e => updateService(i, 'duration_min', parseInt(e.target.value) || 30)}
              />
              <Input
                type="number"
                placeholder="Цена лв"
                value={svc.price}
                onChange={e => updateService(i, 'price', parseInt(e.target.value) || 0)}
              />
              <Button variant="ghost" size="icon" onClick={() => removeService(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {services.length > 0 && (
            <div className="grid grid-cols-[1fr_100px_100px_40px] gap-2 text-xs text-muted-foreground px-1">
              <span>Услуга</span>
              <span>Продължит.</span>
              <span>Цена</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={addService}>
          <Plus className="h-4 w-4 mr-2" />
          Добави услуга
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
