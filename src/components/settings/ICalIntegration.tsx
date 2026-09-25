'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check, ExternalLink } from 'lucide-react'

// Export only. The import half (saved iCal feeds + nightly sync) was removed on
// 25 Sep 2026: migration 007_ical_feeds.sql never reached production, so the
// `ical_feeds` table does not exist and every call returned PGRST205. The UI
// looked functional and failed silently. Git history has the full component if
// the feature is ever sold.

export function ICalIntegration({ icalExportUrl }: { icalExportUrl: string }) {
  const [copied, setCopied] = useState(false)

  function copyExportUrl() {
    navigator.clipboard.writeText(icalExportUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Вашият iCal линк (Експорт)</CardTitle>
          <CardDescription>
            Дайте този линк на Booking.com, Airbnb или Google Calendar, за да виждат
            заетите ви дати. Резервациите и блокираните дати се обновяват автоматично.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={icalExportUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyExportUrl}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <a href={icalExportUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="icon" type="button">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Къде да поставите линка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Booking.com</p>
            <p>Extranet → Календар → Синхронизиране → Импортиране на календар</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Airbnb</p>
            <p>Управление на обяви → Обявата → Наличност → Синхронизиране на календари → Импортиране на календар</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
