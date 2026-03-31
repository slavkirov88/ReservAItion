'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Globe, RefreshCw, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

export function WebsiteScanner() {
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ pagesVisited: number; contentLength: number; preview: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    fetch('/api/settings/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.website_url) setUrl(data.website_url)
        if (data?.website_content) {
          setResult({
            pagesVisited: 0,
            contentLength: data.website_content.length,
            preview: data.website_content.slice(0, 500),
          })
        }
      })
      .catch(() => {})
  }, [])

  const handleScan = async () => {
    if (!url) return
    setScanning(true)
    setError(null)
    setResult(null)

    const res = await fetch('/api/settings/scan-website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    const data = await res.json()
    setScanning(false)

    if (!res.ok) {
      setError(data.error || 'Грешка при сканиране')
      return
    }

    setResult(data)
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">Сайт на хотела</h3>
          <p className="text-xs text-muted-foreground">AI рецепционистът ще отговаря на въпроси използвайки съдържанието от вашия сайт</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">URL на сайта</Label>
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://hotel-example.com"
            disabled={scanning}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleScan} disabled={scanning || !url} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Сканиране...' : 'Сканирай'}
          </Button>
        </div>
      </div>

      {scanning && (
        <p className="text-sm text-muted-foreground animate-pulse">
          Сканиране на сайта — може да отнеме 15-30 секунди...
        </p>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            <span>
              {result.pagesVisited > 0
                ? `Сканирани ${result.pagesVisited} страници · ${Math.round(result.contentLength / 1000)}k символа`
                : `${Math.round(result.contentLength / 1000)}k символа от предишно сканиране`}
            </span>
          </div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showPreview ? 'Скрий преглед' : 'Покажи преглед'}
          </button>
          {showPreview && (
            <pre className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {result.preview}...
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
