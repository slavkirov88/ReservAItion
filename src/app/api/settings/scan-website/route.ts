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
