'use client'

import { Button } from '@/components/ui/button'
import { useTransition } from 'react'

export function LocaleToggle({ currentLocale }: { currentLocale: string }) {
  const [isPending, startTransition] = useTransition()

  function switchLocale(locale: string) {
    startTransition(async () => {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      })
      window.location.reload()
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={currentLocale === 'bg' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => switchLocale('bg')}
        disabled={isPending}
      >
        БГ
      </Button>
      <Button
        variant={currentLocale === 'en' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => switchLocale('en')}
        disabled={isPending}
      >
        EN
      </Button>
    </div>
  )
}
