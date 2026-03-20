'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface HotelStep1ProfileProps {
  onNext: () => void
}

export function HotelStep1Profile({ onNext }: HotelStep1ProfileProps) {
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [languages, setLanguages] = useState<string[]>(['bg'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: businessName, address, phone, languages }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(json.error ?? 'Грешка при запазване')
      }
      onNext()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Неочаквана грешка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="businessName">Наименование на хотела</Label>
        <Input
          id="businessName"
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          required
          placeholder="Хотел Морска Звезда"
        />
      </div>
      <div>
        <Label htmlFor="address">Адрес</Label>
        <Input
          id="address"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="ул. Примерна 1, Варна"
        />
      </div>
      <div>
        <Label htmlFor="phone">Телефон</Label>
        <Input
          id="phone"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+359 88 888 8888"
        />
      </div>
      <div>
        <Label>Езици</Label>
        <div className="flex gap-4 mt-1">
          {['bg', 'en'].map(lang => (
            <label key={lang} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={languages.includes(lang)}
                onChange={e => setLanguages(
                  e.target.checked ? [...languages, lang] : languages.filter(l => l !== lang)
                )}
              />
              <span>{lang === 'bg' ? 'Български' : 'English'}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !businessName.trim()}>
          {loading ? 'Запазване...' : 'Напред'}
        </Button>
      </div>
    </form>
  )
}
