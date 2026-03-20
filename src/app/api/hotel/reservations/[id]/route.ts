import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await request.json() as { status?: string }
  const allowed = ['confirmed', 'cancelled']
  if (raw.status && !allowed.includes(raw.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const body = raw as { status?: 'confirmed' | 'cancelled' | 'on_hold' }

  const { data, error } = await supabase
    .from('room_reservations')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
