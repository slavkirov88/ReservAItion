'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ProfileData {
  business_name: string
  phone: string
  address: string
}

export function ProfileEditor() {
  const [data, setData] = useState<ProfileData>({ business_name: '', phone: '', address: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/profile')
      .then(r => r.json())
      .then((d: ProfileData) => {
        setData({ business_name: d.business_name || '', phone: d.phone || '', address: d.address || '' })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Грешка при запазване')
      setMessage({ type: 'success', text: 'Запазено успешно!' })
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
        <CardTitle className="text-base">Профил на хотела</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Наименование</Label>
          <Input
            value={data.business_name}
            onChange={e => setData(d => ({ ...d, business_name: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Телефон</Label>
          <Input
            value={data.phone}
            onChange={e => setData(d => ({ ...d, phone: e.target.value }))}
            placeholder="+359 888 123 456"
          />
        </div>
        <div className="space-y-2">
          <Label>Адрес</Label>
          <Input
            value={data.address}
            onChange={e => setData(d => ({ ...d, address: e.target.value }))}
            placeholder="ул. Витоша 15, София"
          />
        </div>
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
