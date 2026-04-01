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
  bank_iban: string
  bank_name: string
  company_name: string
  company_address: string
  deposit_percent: number
}

export function ProfileEditor() {
  const [data, setData] = useState<ProfileData>({ business_name: '', phone: '', address: '', bank_iban: '', bank_name: '', company_name: '', company_address: '', deposit_percent: 30 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/profile')
      .then(r => r.json())
      .then((d: ProfileData) => {
        setData({ business_name: d.business_name || '', phone: d.phone || '', address: d.address || '', bank_iban: d.bank_iban || '', bank_name: d.bank_name || '', company_name: d.company_name || '', company_address: d.company_address || '', deposit_percent: d.deposit_percent ?? 30 })
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
        <div className="border-t pt-4 mt-2">
          <h3 className="text-sm font-semibold mb-3">Банкови данни и капаро</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Фирма (юридическо лице)</Label>
              <Input
                value={data.company_name}
                onChange={e => setData(d => ({ ...d, company_name: e.target.value }))}
                placeholder="ООД / ЕООД наименование"
              />
            </div>
            <div className="space-y-2">
              <Label>Адрес на фирмата</Label>
              <Input
                value={data.company_address}
                onChange={e => setData(d => ({ ...d, company_address: e.target.value }))}
                placeholder="ул. Витоша 15, София"
              />
            </div>
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input
                value={data.bank_iban}
                onChange={e => setData(d => ({ ...d, bank_iban: e.target.value }))}
                placeholder="BG80BNBG96611020345678"
              />
            </div>
            <div className="space-y-2">
              <Label>Банка</Label>
              <Input
                value={data.bank_name}
                onChange={e => setData(d => ({ ...d, bank_name: e.target.value }))}
                placeholder="UniCredit Bulbank"
              />
            </div>
            <div className="space-y-2">
              <Label>Капаро (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={data.deposit_percent}
                onChange={e => setData(d => ({ ...d, deposit_percent: Number(e.target.value) }))}
              />
            </div>
          </div>
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
