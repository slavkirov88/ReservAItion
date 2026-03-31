// src/lib/website-scanner.ts

const MAX_PAGES = 50
const FETCH_TIMEOUT_MS = 8000

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

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1])
  const links: string[] = []
  for (const href of hrefs) {
    try {
      const url = new URL(href, baseUrl)
      url.hash = ''
      url.search = ''
      if (
        url.hostname === base.hostname &&
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        !href.match(/\.(pdf|jpg|jpeg|png|gif|svg|zip|doc|docx|xls)$/i)
      ) {
        links.push(url.toString())
      }
    } catch {
      // skip invalid URLs
    }
  }
  return [...new Set(links)]
}

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
      if (text.length > 100) textParts.push(`=== ${url} ===\n${text}`)
      const links = extractInternalLinks(html, url)
      for (const link of links) {
        if (!visited.has(link)) queue.push(link)
      }
    } catch {
      // skip failed pages
    }
  }

  if (textParts.length === 0) {
    return { text: '', pagesVisited: 0, error: 'Не успяхме да извлечем съдържание от сайта' }
  }

  const combined = textParts.join('\n\n')
  const text = combined.length > 40000 ? combined.slice(0, 40000) + '\n...(truncated)' : combined
  return { text, pagesVisited: visited.size }
}
