'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface HotelStep5AIConfigProps {
  onBack: () => void
}

export function HotelStep5AIConfig({ onBack }: HotelStep5AIConfigProps) {
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Здравейте! Добре дошли в нашия хотел. Как мога да ви помогна?'
  )
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoLive() {
    setLoading(true)
    setError(null)
    try {
      // Save welcome message to AI settings
      await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcome_message_bg: welcomeMessage }),
      })

      // Complete hotel onboarding — creates Vapi assistant and marks trial start
      const res = await fetch('/api/onboarding/hotel-complete', {
        method: 'POST',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(json.error ?? 'Грешка при активиране')
      }
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Неочаквана грешка')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="text-4xl">🎉</div>
        <h3 className="text-xl font-semibold">Вашият AI рецепционист е активен!</h3>
        <p className="text-muted-foreground">
          Вашият 7-дневен безплатен период е стартиран. AI асистентът вече може да приема резервации.
        </p>
        <Button onClick={() => window.location.href = '/dashboard'}>
          Към Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="welcomeMessage">Приветствено съобщение (на български)</Label>
        <Textarea
          id="welcomeMessage"
          value={welcomeMessage}
          onChange={e => setWelcomeMessage(e.target.value)}
          rows={4}
          placeholder="Здравейте! Добре дошли..."
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Това е първото нещо, което AI рецепционистът ще каже на обаждащите се гости.
        </p>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={loading}>Назад</Button>
        <Button onClick={() => void handleGoLive()} disabled={loading}>
          {loading ? 'Активиране...' : 'Активирай (Go Live)'}
        </Button>
      </div>
    </div>
  )
}
