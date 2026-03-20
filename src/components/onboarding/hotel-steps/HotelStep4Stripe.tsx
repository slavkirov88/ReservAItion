'use client'

import { Button } from '@/components/ui/button'

interface HotelStep4StripeProps {
  onNext: () => void
  onBack: () => void
}

export function HotelStep4Stripe({ onNext, onBack }: HotelStep4StripeProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-2">
        <h3 className="font-medium">Свържете своя Stripe акаунт</h3>
        <p className="text-sm text-muted-foreground">
          Свържете своя Stripe акаунт, за да получавате плащания от гости.
          Посетете Stripe Dashboard, за да настроите вашия акаунт.
        </p>
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-primary underline underline-offset-4"
        >
          Отвори Stripe Dashboard →
        </a>
      </div>
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>Назад</Button>
        <Button onClick={onNext}>Продължи</Button>
      </div>
    </div>
  )
}
