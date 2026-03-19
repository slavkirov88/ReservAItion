import { createServiceClient } from '@/lib/supabase/server'
import { generateIcalFeed } from '@/lib/hotel/ical'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createServiceClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('id, name, tenant_id, tenants(business_name)')
    .eq('id', roomId)
    .single()

  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: reservations } = await supabase
    .from('room_reservations')
    .select('id, guest_name, check_in, check_out')
    .eq('room_id', roomId)
    .in('status', ['confirmed', 'on_hold'])

  const hotelName = (room.tenants as unknown as { business_name: string } | null)?.business_name ?? 'Hotel'
  const feed = generateIcalFeed(reservations ?? [], hotelName, roomId)

  return new Response(feed, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${roomId}.ics"`,
    },
  })
}
