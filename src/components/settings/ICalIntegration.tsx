'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Plus, Trash2, RefreshCw, Check, ExternalLink } from 'lucide-react'

interface SyncResult {
  imported: number
  skipped: number
  errors: string[]
}

export function ICalIntegration({ icalExportUrl }: { icalExportUrl: string }) {
  const [icalUrls, setIcalUrls] = useState<string[]>([''])
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [copied, setCopied] = useState(false)

  function copyExportUrl() {
    navigator.clipboard.writeText(icalExportUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function updateUrl(i: number, value: string) {
    setIcalUrls(urls => urls.map((u, idx) => idx === i ? value : u))
  }

  function addUrl() {
    setIcalUrls(urls => [...urls, ''])
  }

  function removeUrl(i: number) {
    setIcalUrls(urls => urls.filter((_, idx) => idx !== i))
  }

  async function handleSync() {
    const validUrls = icalUrls.filter(u => u.trim())
    if (validUrls.length === 0) return

    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ical_urls: validUrls }),
      })
      const data = await res.json() as SyncResult
      setResult(data)
    } catch {
      setResult({ imported: 0, skipped: 0, errors: ['Грешка при свързване'] })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Вашият iCal линк (Експорт)</CardTitle>
          <CardDescription>
            Дайте този линк на Booking.com, Airbnb или Google Calendar — те ще виждат вашите резервации в реално време.
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

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">iCal линкове от други платформи (Импорт)</CardTitle>
          <CardDescription>
            Поставете iCal линковете от Booking.com, Airbnb и др. Резервациите им ще се внесат автоматично.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {icalUrls.map((url, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="https://admin.booking.com/hotel/hoteladmin/ical.html?..."
                value={url}
                onChange={e => updateUrl(i, e.target.value)}
                className="font-mono text-xs"
              />
              {icalUrls.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeUrl(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addUrl}>
              <Plus className="h-4 w-4 mr-2" />
              Добави линк
            </Button>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing || icalUrls.every(u => !u.trim())}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Синхронизиране...' : 'Синхронизирай сега'}
            </Button>
          </div>

          {result && (
            <div className={`rounded-md p-3 text-sm ${result.errors.length > 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
              {result.errors.length === 0 ? (
                <>✓ Внесени: <strong>{result.imported}</strong> · Вече съществуват: <strong>{result.skipped}</strong></>
              ) : (
                <div>
                  <p>Внесени: {result.imported} · Пропуснати: {result.skipped}</p>
                  {result.errors.map((e, i) => <p key={i} className="mt-1 text-xs">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Как да намерите iCal линка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Booking.com</p>
            <p>Extranet → Календар → Синхронизиране → iCal → Копирай линка за импорт</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Airbnb</p>
            <p>Управление на обяви → Обявата → Наличност → Синхронизиране на календари → Експортиране на iCal</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Google Calendar</p>
            <p>Настройки на календара → Интегрирай → Адрес в iCal формат</p>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
