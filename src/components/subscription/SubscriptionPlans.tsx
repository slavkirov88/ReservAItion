'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import type { PlanKey } from '@/lib/stripe/stripe'

interface SubscriptionPlansProps {
  subscriptionStatus: 'trial' | 'active' | 'cancelled' | 'past_due'
  daysLeft: number | null
}

const PLANS_UI = [
  {
    key: 'starter' as PlanKey,
    name: 'Стартов',
    price: 149,
    features: ['1 телефонен номер', 'Неограничени обаждания', 'Чат уиджет', 'Базово табло'],
  },
  {
    key: 'pro' as PlanKey,
    name: 'Pro',
    price: 299,
    features: ['3 телефонни номера', 'Приоритетна поддръжка', 'Разширена аналитика', 'API достъп'],
    recommended: true,
  },
]

export function SubscriptionPlans({ subscriptionStatus, daysLeft }: SubscriptionPlansProps) {
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade(planKey: PlanKey) {
    setLoading(planKey)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to create checkout session')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {subscriptionStatus === 'trial' && daysLeft !== null && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-sm font-medium text-yellow-500">
            Пробният период изтича след {daysLeft} {daysLeft === 1 ? 'ден' : 'дни'}.
            Изберете план, за да продължите да използвате ReservAItion.
          </p>
        </div>
      )}

      {subscriptionStatus === 'past_due' && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-500">
            Плащането неуспешно. Моля, актуализирайте начина на плащане.
          </p>
        </div>
      )}

      {subscriptionStatus === 'active' && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-500">
            Абонаментът ви е активен.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {PLANS_UI.map(plan => (
          <Card key={plan.key} className={plan.recommended ? 'border-primary' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.recommended && <Badge>Препоръчан</Badge>}
              </div>
              <div className="text-3xl font-bold">{plan.price} лв<span className="text-sm font-normal text-muted-foreground">/мес</span></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.recommended ? 'default' : 'outline'}
                disabled={subscriptionStatus === 'active' || loading !== null}
                onClick={() => handleUpgrade(plan.key)}
              >
                {loading === plan.key ? 'Зареждане...' : 'Избери план'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
