'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Plus, Trash2, RefreshCw, Check, ExternalLink } from 'lucide-react'
import type { ICalFeedRow } from '@/types/database'

interface SyncResult {
  imported: number
  skipped: number
  errors: string[]
}

export function ICalIntegration({ icalExportUrl }: { icalExportUrl: string }) {
  const [feeds, setFeeds] = useState<ICalFeedRow[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchFeeds = useCallback(async () => {
    const res = await fetch('/api/ical/feeds')
    if (res.ok) setFeeds(await res.json())
  }, [])

  useEffect(() => { fetchFeeds() }, [fetchFeeds])

  async function handleAdd() {
    if (!newUrl.trim()) return
    setAdding(true)
    const res = await fetch('/api/ical/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newUrl.trim(), label: newLabel.trim() || null }),
    })
    setAdding(false)
    if (res.ok) {
      setNewUrl('')
      setNewLabel('')
      fetchFeeds()
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/ical/feeds/${id}`, { method: 'DELETE' })
    fetchFeeds()
  }

  async function handleSync() {
    if (feeds.length === 0) return
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ical_urls: feeds.map(f => f.url) }),
      })
      setResult(await res.json() as SyncResult)
    } catch {
      setResult({ imported: 0, skipped: 0, errors: ['Грешка при свързване'] })
    } finally {
      setSyncing(false)
      fetchFeeds()
    }
  }

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
            Дайте този линк на Booking.com, Airbnb или Google Calendar.
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
          <CardTitle className="text-base">iCal линкове от други платформи (Импорт)</CardTitle>
          <CardDescription>
            Запазените линкове се синхронизират автоматично всяка сутрин в 08:00.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feeds.length > 0 && (
            <div className="space-y-2">
              {feeds.map(f => (
                <div key={f.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <div className="flex-1 min-w-0">
                    {f.label && <p className="text-xs font-medium text-muted-foreground mb-0.5">{f.label}</p>}
                    <p className="font-mono text-xs truncate">{f.url}</p>
                    {f.last_synced_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Последна синхр.: {new Date(f.last_synced_at).toLocaleDateString('bg-BG')}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Input
              placeholder="Booking.com, Airbnb..."
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Input
                placeholder="https://admin.booking.com/hotel/.../ical.html?..."
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={handleAdd} disabled={adding || !newUrl.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Добави
              </Button>
            </div>
          </div>

          <Button size="sm" onClick={handleSync} disabled={syncing || feeds.length === 0}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизиране...' : 'Синхронизирай сега'}
          </Button>

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
        </CardContent>
      </Card>
    </div>
  )
}
