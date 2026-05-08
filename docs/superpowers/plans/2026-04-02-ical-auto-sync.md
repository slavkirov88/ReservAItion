# iCal Auto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist iCal feed URLs in the database and sync them automatically once daily via cron.

**Architecture:** Add `ical_feeds` table to store external iCal URLs per tenant. Update the ICalIntegration UI to save/load URLs from DB. Add a cron endpoint `/api/cron/sync-ical` that reads all saved feeds and imports new reservations. Register the cron in `vercel.json`.

**Tech Stack:** Next.js API routes, Supabase (PostgreSQL + RLS), existing `parseICalFeed()` in `src/lib/ical.ts`, Vercel cron (Hobby = once daily)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/007_ical_feeds.sql` | CREATE | New table + RLS policies |
| `src/types/database.ts` | MODIFY | Add `ICalFeedRow` type |
| `src/app/api/ical/feeds/route.ts` | CREATE | GET + POST ical_feeds |
| `src/app/api/ical/feeds/[id]/route.ts` | CREATE | DELETE ical_feed by id |
| `src/components/settings/ICalIntegration.tsx` | MODIFY | Load/save URLs from DB instead of local state |
| `src/app/api/cron/sync-ical/route.ts` | CREATE | Cron endpoint — syncs all tenants' feeds |
| `vercel.json` | MODIFY | Add cron schedule for sync-ical |

---

## Task 1: DB Migration — ical_feeds table

**Files:**
- Create: `supabase/migrations/007_ical_feeds.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/007_ical_feeds.sql

CREATE TABLE IF NOT EXISTS ical_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ical_feeds_tenant_idx ON ical_feeds(tenant_id);

ALTER TABLE ical_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ical_feeds_tenant_own" ON ical_feeds
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid())
  );
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Go to Supabase dashboard → SQL Editor → paste and run the migration.
Expected: "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_ical_feeds.sql
git commit -m "feat: add ical_feeds migration"
```

---

## Task 2: TypeScript type for ICalFeedRow

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add type**

Find the types file and add after the last Row type:

```typescript
export interface ICalFeedRow {
  id: string
  tenant_id: string
  url: string
  label: string | null
  last_synced_at: string | null
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add ICalFeedRow type"
```

---

## Task 3: API routes for ical_feeds CRUD

**Files:**
- Create: `src/app/api/ical/feeds/route.ts`
- Create: `src/app/api/ical/feeds/[id]/route.ts`

- [ ] **Step 1: Create GET + POST route**

```typescript
// src/app/api/ical/feeds/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { data } = await supabase
    .from('ical_feeds')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at')

  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { url, label } = await req.json() as { url: string; label?: string }
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const { data, error } = await supabase
    .from('ical_feeds')
    .insert({ tenant_id: tenant.id, url, label: label || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Create DELETE route**

```typescript
// src/app/api/ical/feeds/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('ical_feeds')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ical/feeds/route.ts src/app/api/ical/feeds/[id]/route.ts
git commit -m "feat: add ical_feeds API routes (GET, POST, DELETE)"
```

---

## Task 4: Update ICalIntegration component — persist URLs in DB

**Files:**
- Modify: `src/components/settings/ICalIntegration.tsx`

Currently the component holds URLs in local React state only. Replace with DB-backed state.

- [ ] **Step 1: Rewrite ICalIntegration.tsx**

```typescript
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

      {/* Export */}
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

      {/* Import feeds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">iCal линкове от други платформи (Импорт)</CardTitle>
          <CardDescription>
            Запазените линкове се синхронизират автоматично всяка сутрин.
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

          {/* Add new URL */}
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

          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing || feeds.length === 0}
          >
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
        </CardContent>
      </Card>

    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/ICalIntegration.tsx
git commit -m "feat: persist ical feed URLs in DB, load on mount"
```

---

## Task 5: Cron endpoint — auto-sync all tenants

**Files:**
- Create: `src/app/api/cron/sync-ical/route.ts`

- [ ] **Step 1: Create cron route**

```typescript
// src/app/api/cron/sync-ical/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseICalFeed } from '@/lib/ical'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // Get all saved feeds
  const { data: feeds } = await supabase
    .from('ical_feeds')
    .select('id, tenant_id, url')

  if (!feeds || feeds.length === 0) {
    return NextResponse.json({ message: 'No feeds to sync', synced: 0 })
  }

  let totalImported = 0
  let totalSkipped = 0
  const errors: string[] = []

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'ReservAItion/1.0' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const text = await res.text()
      const events = parseICalFeed(text)

      for (const ev of events) {
        if (ev.status === 'CANCELLED') continue

        const { data: existing } = await supabase
          .from('reservations')
          .select('id')
          .eq('tenant_id', feed.tenant_id)
          .eq('external_uid', ev.uid)
          .single()

        if (existing) { totalSkipped++; continue }

        await supabase.from('reservations').insert({
          tenant_id: feed.tenant_id,
          guest_name: ev.summary || 'Блокиран период',
          guest_phone: '-',
          check_in_date: ev.dtstart,
          check_out_date: ev.dtend,
          status: 'confirmed',
          channel: 'manual',
          notes: `Auto-sync от iCal: ${feed.url}`,
          external_uid: ev.uid,
        })
        totalImported++
      }

      // Update last_synced_at
      await supabase
        .from('ical_feeds')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', feed.id)

    } catch (err) {
      errors.push(`Feed ${feed.id}: ${err instanceof Error ? err.message : 'Грешка'}`)
    }
  }

  console.log(`[cron/sync-ical] imported=${totalImported} skipped=${totalSkipped} errors=${errors.length}`)
  return NextResponse.json({ imported: totalImported, skipped: totalSkipped, errors })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/sync-ical/route.ts
git commit -m "feat: add cron endpoint for automatic iCal sync"
```

---

## Task 6: Register cron in vercel.json

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add cron job**

Current `vercel.json`:
```json
{
  "functions": {
    "src/app/api/vapi/**": { "maxDuration": 30 },
    "src/app/api/stripe/webhook": { "maxDuration": 10 }
  },
  "crons": [
    { "path": "/api/cron/expire-deposits", "schedule": "0 9 * * *" }
  ]
}
```

Update to:
```json
{
  "functions": {
    "src/app/api/vapi/**": { "maxDuration": 30 },
    "src/app/api/stripe/webhook": { "maxDuration": 10 }
  },
  "crons": [
    { "path": "/api/cron/expire-deposits", "schedule": "0 9 * * *" },
    { "path": "/api/cron/sync-ical", "schedule": "0 8 * * *" }
  ]
}
```

> Note: Vercel Hobby allows max 2 crons total. Both are within limit.

- [ ] **Step 2: Commit and deploy**

```bash
git add vercel.json
git commit -m "feat: register sync-ical cron job (daily 08:00)"
git push
npx vercel deploy --prod
```

---

## Testing

After deploy:

1. Go to Settings → Integrations in the app
2. Add a Booking.com iCal URL with label "Booking.com"
3. Click "Синхронизирай сега" — should show "Внесени: X"
4. Check Reservations page — imported reservations should appear with `channel: manual`
5. Automatic sync runs daily at 08:00 Sofia time

To test cron manually:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://reservaition.io/api/cron/sync-ical
```
