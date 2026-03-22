'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle, Copy } from 'lucide-react'

interface Props {
  vapiPhone: string
  publicApiKey: string
}

export function Step5Complete({ vapiPhone, publicApiKey }: Props) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://receptai.bg'
  const embedCode = `<script src="${appUrl}/widget.js" data-key="${publicApiKey}"></script>`

  function copy(text: string) {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <CheckCircle className="h-16 w-16 text-green-500" />
      </div>
      <div>
        <h3 className="text-xl font-semibold">Готово! ReservAItion е активен.</h3>
        <p className="text-muted-foreground mt-1">Вашият AI рецепционист е настроен и готов за работа.</p>
      </div>

      <div className="text-left space-y-4">
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-sm font-medium">Телефонен номер на AI рецепциониста</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-muted rounded px-2 py-1">{vapiPhone || 'Задава се от Настройки → Профил'}</code>
            {vapiPhone && (
              <Button variant="ghost" size="icon" onClick={() => copy(vapiPhone)} className="h-8 w-8">
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-sm font-medium">Код за вграждане на чат</p>
          <div className="flex items-start gap-2">
            <code className="flex-1 text-xs bg-muted rounded px-2 py-2 break-all">{embedCode}</code>
            <Button variant="ghost" size="icon" onClick={() => copy(embedCode)} className="h-8 w-8 shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Поставете го преди затварящия &lt;/body&gt; таг на вашия сайт.</p>
        </div>
      </div>
    </div>
  )
}
