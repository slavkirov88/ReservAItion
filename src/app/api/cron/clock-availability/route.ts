// ---------------------------------------------------------------------------
// Refills `clock_availability_cache` for every tenant wired to Clock.
//
// Clock calls rates_availability their heaviest endpoint and asks for it every
// 15-20 minutes with caching on our side. That is exactly why the voice agent
// never calls it: by the time a guest is on the line, the answer is already in
// our database.
//
// NOT registered in vercel.json. The Hobby plan allows two cron entries and
// both are taken, and it only schedules daily anyway. For sprint 1 this is
// called by hand before a demo; the pilot hotel gets a real scheduler.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { listClockTenants } from '@/lib/clock/config'
import { getRatesAvailability, getRoomTypes } from '@/lib/clock/voice'
import { toCacheRows } from '@/lib/clock/availability-map'

/** How far ahead the agent can quote. Their own ceiling is 365 days. */
const HORIZON_DAYS = 90

const iso = (d: Date) => d.toISOString().slice(0, 10)

export async function GET(request: Request) {
  // An unset secret refuses everything. Without the first check a missing
  // environment variable turns the literal header 'Bearer undefined' into a key.
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const tenants = await listClockTenants(supabase)

  if (tenants.length === 0) {
    return NextResponse.json({ message: 'No tenants wired to Clock', tenants: 0, rows: 0 })
  }

  const from = new Date()
  const to = new Date(from)
  to.setDate(to.getDate() + HORIZON_DAYS)

  let totalRows = 0
  const errors: string[] = []

  for (const config of tenants) {
    try {
      // Virtual room types are combinations sold as one unit. They have no
      // door of their own, so offering one over the phone promises a room
      // that does not physically exist.
      const roomTypes = (await getRoomTypes(config.creds)).filter((t) => t.is_virtual !== true)
      const names = Object.fromEntries(roomTypes.map((t) => [t.id, t.name]))

      const roomTypeIds = config.roomTypeIds.length > 0
        ? config.roomTypeIds.filter((id) => names[id] !== undefined)
        : roomTypes.map((t) => t.id)

      if (config.rateIds.length === 0 || roomTypeIds.length === 0) {
        errors.push(`${config.tenantId}: no rates or no room types configured`)
        continue
      }

      const response = await getRatesAvailability(config.creds, {
        from: iso(from),
        to: iso(to),
        rateIds: config.rateIds,
        roomTypeIds,
      })

      const rows = toCacheRows(config.tenantId, response, names)
      if (rows.length === 0) {
        errors.push(`${config.tenantId}: Clock answered with no days`)
        continue
      }

      // Replace this tenant's window rather than deleting first: a failed
      // refresh leaves yesterday's cache in place, which the agent can still
      // quote with a staleness warning. An empty cache can only say "no".
      const { error } = await supabase
        .from('clock_availability_cache')
        .upsert(rows, { onConflict: 'tenant_id,clock_room_type_id,clock_rate_id,date' })

      if (error) throw new Error(error.message)
      totalRows += rows.length
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[clock-availability] ${config.tenantId}:`, message)
      errors.push(`${config.tenantId}: ${message}`)
    }
  }

  return NextResponse.json({
    tenants: tenants.length,
    rows: totalRows,
    from: iso(from),
    to: iso(to),
    errors,
  })
}
