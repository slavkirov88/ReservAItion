// Supabase Edge Function: ical-sync
// Runs every 30 minutes via cron schedule (configured in Supabase dashboard)
// Fetches iCal feeds for all rooms and upserts blocks into ical_blocks table
// Per-room error isolation: a failing room is skipped, others continue

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseIcalFeed } from '../_shared/ical-parser.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('id, tenant_id, ical_url, name')
    .not('ical_url', 'is', null)

  if (error) {
    console.error('Failed to fetch rooms:', error.message)
    return new Response('DB error fetching rooms', { status: 500 })
  }

  const results: string[] = []

  for (const room of rooms ?? []) {
    if (!room.ical_url) continue

    let icalText: string
    try {
      const res = await fetch(room.ical_url)
      if (!res.ok) {
        const msg = `SKIP ${room.id} (${room.name}): HTTP ${res.status}`
        console.warn(msg)
        results.push(msg)
        continue
      }
      icalText = await res.text()
    } catch (e) {
      const msg = `SKIP ${room.id} (${room.name}): network error - ${e}`
      console.warn(msg)
      results.push(msg)
      continue
    }

    const blocks = parseIcalFeed(icalText, room.id, room.tenant_id, room.ical_url)
    if (blocks.length === 0) {
      const msg = `SKIP ${room.id} (${room.name}): no events or parse error`
      console.warn(msg)
      results.push(msg)
      continue
    }

    // Replace all blocks for this room only on successful parse
    const { error: deleteError } = await supabase
      .from('ical_blocks')
      .delete()
      .eq('room_id', room.id)

    if (deleteError) {
      const msg = `ERROR ${room.id} (${room.name}): delete failed - ${deleteError.message}`
      console.error(msg)
      results.push(msg)
      continue
    }

    const { error: insertError } = await supabase
      .from('ical_blocks')
      .insert(blocks)

    const msg = insertError
      ? `ERROR ${room.id} (${room.name}): insert failed - ${insertError.message}`
      : `OK ${room.id} (${room.name}): ${blocks.length} blocks synced`
    console.log(msg)
    results.push(msg)
  }

  return new Response(results.join('\n') || 'No rooms with iCal URLs', { status: 200 })
})
