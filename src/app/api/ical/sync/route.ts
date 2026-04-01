import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseICalFeed } from '@/lib/ical'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  const { ical_urls } = await request.json() as { ical_urls: string[] }

  if (!Array.isArray(ical_urls) || ical_urls.length === 0) {
    return NextResponse.json({ error: 'ical_urls array required' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const url of ical_urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'ReservAItion/1.0' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const text = await res.text()
      const events = parseICalFeed(text)

      for (const ev of events) {
        // Skip cancelled events
        if (ev.status === 'CANCELLED') continue

        // Check if already imported (by external_uid)
        const { data: existing } = await serviceClient
          .from('reservations')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('external_uid', ev.uid)
          .single()

        if (existing) { skipped++; continue }

        await serviceClient
          .from('reservations')
          .insert({
            tenant_id: tenant.id,
            guest_name: ev.summary || 'Блокиран период',
            guest_phone: '-',
            check_in_date: ev.dtstart,
            check_out_date: ev.dtend,
            status: 'confirmed',
            channel: 'manual',
            notes: `Внесено от iCal: ${url}`,
            external_uid: ev.uid,
          })

        imported++
      }
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : 'Грешка'}`)
    }
  }

  return NextResponse.json({ imported, skipped, errors })
}
