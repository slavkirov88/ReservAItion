# Website Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow hotel owners to scan their website so the AI receptionist can answer guest questions using real content from the site.

**Architecture:** A crawler (`website-scanner.ts`) fetches the hotel website, extracts clean text from all internal pages, and stores it in the `tenants` table. A POST API route triggers the crawl. The text is injected into the AI system prompt via `prompt-generator.ts`. A UI component in AI Settings lets the owner enter the URL, trigger scans, and preview the result.

**Tech Stack:** Next.js 16 API routes, Supabase PostgreSQL, TypeScript, native `fetch` + regex HTML parsing (no extra libraries)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/005_website_content.sql` | Create | Add `website_url` + `website_content` columns to `tenants` |
| `src/lib/website-scanner.ts` | Create | Crawl URL, extract text, follow internal links |
| `src/app/api/settings/scan-website/route.ts` | Create | POST endpoint — triggers scan, saves to DB |
| `src/components/settings/WebsiteScanner.tsx` | Create | UI: URL input + Scan button + status + preview |
| `src/components/settings/AIConfigEditor.tsx` | Modify | Add `<WebsiteScanner />` section at the bottom |
| `src/lib/ai/prompt-generator.ts` | Modify | Add `website_content` param to `HotelProfile`, inject into prompt |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/005_website_content.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/005_website_content.sql
alter table tenants
  add column if not exists website_url text,
  add column if not exists website_content text;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Open Supabase Dashboard → SQL Editor → paste and run.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_website_content.sql
git commit -m "feat: add website_url and website_content columns to tenants"
```

---

## Task 2: Website Scanner Library

**Files:**
- Create: `src/lib/website-scanner.ts`

- [ ] **Step 1: Create the scanner**

```typescript
// src/lib/website-scanner.ts

const MAX_PAGES = 50
const FETCH_TIMEOUT_MS = 8000

/**
 * Extracts clean readable text from HTML — removes tags, scripts, styles, nav, footer.
 */
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Extracts all internal links from HTML for the given base domain.
 */
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1])
  const links: string[] = []

  for (const href of hrefs) {
    try {
      const url = new URL(href, baseUrl)
      // Only same-origin, only http/https, no anchors, no files
      if (
        url.hostname === base.hostname &&
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        !href.match(/\.(pdf|jpg|jpeg|png|gif|svg|zip|doc|docx|xls)$/i)
      ) {
        url.hash = ''
        links.push(url.toString())
      }
    } catch {
      // skip invalid URLs
    }
  }

  return [...new Set(links)]
}

/**
 * Crawls a website starting from the given URL.
 * Returns concatenated clean text from all visited pages.
 */
export async function scanWebsite(startUrl: string): Promise<{ text: string; pagesVisited: number; error?: string }> {
  const visited = new Set<string>()
  const queue: string[] = [startUrl]
  const textParts: string[] = []

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const url = queue.shift()!
    if (visited.has(url)) continue
    visited.add(url)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ReservAItion-Bot/1.0' },
      })
      clearTimeout(timeout)

      if (!res.ok) continue

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) continue

      const html = await res.text()
      const text = extractText(html)
      if (text.length > 100) {
        textParts.push(`=== ${url} ===\n${text}`)
      }

      const links = extractInternalLinks(html, url)
      for (const link of links) {
        if (!visited.has(link)) queue.push(link)
      }
    } catch {
      // skip pages that fail (timeout, network error, etc.)
    }
  }

  if (textParts.length === 0) {
    return { text: '', pagesVisited: 0, error: 'Не успяхме да извлечем съдържание от сайта' }
  }

  const combined = textParts.join('\n\n')
  // Truncate to ~40k chars to stay within reasonable prompt size
  const text = combined.length > 40000 ? combined.slice(0, 40000) + '\n...(truncated)' : combined

  return { text, pagesVisited: visited.size }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors on this file

- [ ] **Step 3: Commit**

```bash
git add src/lib/website-scanner.ts
git commit -m "feat: website scanner crawler library"
```

---

## Task 3: Scan API Route

**Files:**
- Create: `src/app/api/settings/scan-website/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/settings/scan-website/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scanWebsite } from '@/lib/website-scanner'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const body = await req.json()
  const { url } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL е задължителен' }, { status: 400 })
  }

  // Validate URL format
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'URL трябва да започва с http:// или https://' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Невалиден URL' }, { status: 400 })
  }

  const result = await scanWebsite(url)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  const { error: dbError } = await supabase
    .from('tenants')
    .update({ website_url: url, website_content: result.text })
    .eq('id', tenant.id)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    pagesVisited: result.pagesVisited,
    contentLength: result.text.length,
    preview: result.text.slice(0, 500),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/settings/scan-website/route.ts
git commit -m "feat: scan-website API route"
```

---

## Task 3b: Update Profile API to Return Website Fields

**Files:**
- Modify: `src/app/api/settings/profile/route.ts`

- [ ] **Step 1: Add `website_url` and `website_content` to the GET select**

Find the GET handler in `src/app/api/settings/profile/route.ts`. Find the line that selects tenant fields (currently selects `business_name, slug, phone, address, languages`) and add `website_url, website_content`:

```typescript
.select('business_name, slug, phone, address, languages, website_url, website_content')
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/settings/profile/route.ts
git commit -m "feat: include website_url and website_content in profile API response"
```

---

## Task 4: WebsiteScanner UI Component

**Files:**
- Create: `src/components/settings/WebsiteScanner.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/settings/WebsiteScanner.tsx
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
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  // Load existing website_url on mount
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
    setLastScanned(new Date().toLocaleDateString('bg-BG'))
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

      {error && (
        <p className="text-sm text-rose-400">{error}</p>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            <span>
              {result.pagesVisited > 0
                ? `Сканирани ${result.pagesVisited} страници · ${Math.round(result.contentLength / 1000)}k символа извлечени`
                : `${Math.round(result.contentLength / 1000)}k символа заредени от предишно сканиране`}
              {lastScanned && ` · ${lastScanned}`}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/WebsiteScanner.tsx
git commit -m "feat: WebsiteScanner UI component"
```

---

## Task 5: Add WebsiteScanner to AI Settings

**Files:**
- Modify: `src/components/settings/AIConfigEditor.tsx`

- [ ] **Step 1: Add import and component**

In `src/components/settings/AIConfigEditor.tsx`, add the import at the top:
```typescript
import { WebsiteScanner } from '@/components/settings/WebsiteScanner'
```

Find the return JSX and add `<WebsiteScanner />` as the last section before the closing tag:
```tsx
{/* Website Scanner */}
<WebsiteScanner />
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/AIConfigEditor.tsx
git commit -m "feat: add WebsiteScanner to AI settings"
```

---

## Task 6: Inject Website Content into System Prompt

**Files:**
- Modify: `src/lib/ai/prompt-generator.ts`

- [ ] **Step 1: Add `website_content` to `HotelProfile` interface**

Find the `HotelProfile` interface and add:
```typescript
export interface HotelProfile {
  business_name: string
  address: string
  room_types: RoomTypeItem[]
  faqs: FaqItem[]
  booking_rules: string
  welcome_message_bg: string
  website_content?: string  // add this line
}
```

- [ ] **Step 2: Inject website_content into the prompt**

In `generateSystemPrompt`, find the return template string and add after the FAQ/rules section:

```typescript
${profile.website_content ? `\nДОПЪЛНИТЕЛНА ИНФОРМАЦИЯ ОТ САЙТА НА ХОТЕЛА:\n${profile.website_content}\n` : ''}
```

Place it just before the `КАК ДА ЗАПИСВАШ РЕЗЕРВАЦИЯ:` section.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/prompt-generator.ts
git commit -m "feat: inject website_content into AI system prompt"
```

---

## Task 7: Update all callers of generateSystemPrompt + VapiProfile

**Files:**
- Modify: `src/app/api/chat/[apiKey]/route.ts`
- Modify: `src/lib/vapi/vapi-service.ts`
- Modify: wherever vapi-service functions are called

- [ ] **Step 1: Update chat API route**

In `src/app/api/chat/[apiKey]/route.ts`, find the tenant select query and add `website_content`:
```typescript
.select('..., website_content')
```
Then in the `HotelProfile` object passed to `generateSystemPrompt`, add:
```typescript
website_content: tenant.website_content || undefined,
```

- [ ] **Step 2: Update VapiProfile interface in vapi-service.ts**

In `src/lib/vapi/vapi-service.ts`, find the `VapiProfile` interface and add:
```typescript
website_content?: string
```
Then in both `createVapiAssistant()` and `updateVapiAssistant()`, add `website_content` when building the `HotelProfile` for `generateSystemPrompt`:
```typescript
website_content: profile.website_content || undefined,
```

- [ ] **Step 3: Update callers of createVapiAssistant/updateVapiAssistant**

Search for callers: `grep -r "createVapiAssistant\|updateVapiAssistant" src/ --include="*.ts" -l`

For each caller, ensure the tenant select includes `website_content` and it is passed in the profile object.

- [ ] **Step 4: Push and deploy**

```bash
git add -A
git commit -m "feat: pass website_content to all AI prompt generators"
git push origin master
```

---

## Done ✓

Website Scanner is complete:
- Hotel owner enters URL in AI Settings → Сайт на хотела
- Clicks "Сканирай" → crawler visits all internal pages, extracts text
- Text stored in `tenants.website_content`
- Injected into AI system prompt automatically
- "Опресни" re-scans on demand
