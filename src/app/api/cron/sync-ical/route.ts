import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseICalFeed } from '@/lib/ical'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

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
