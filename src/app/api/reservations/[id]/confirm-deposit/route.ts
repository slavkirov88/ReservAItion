import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendReservationConfirmation } from '@/lib/email/resend'
import type { ReservationEmailData } from '@/lib/email/templates/reservation-confirmation'
import type { ReservationRow, TenantRow } from '@/types/database'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get tenant owned by user
  const { data: tenant } = await supabase.from('tenants').select('id, business_name, phone, address').eq('owner_id', user.id).single() as unknown as { data: Partial<TenantRow> | null }
  if (!tenant || !tenant.id) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  // Fetch reservation
  const { data: reservation, error: queryError } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenant.id as string)
    .single() as unknown as { data: ReservationRow | null; error: any }

  if (queryError || !reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  // Check status is pending_payment
  if (reservation.status !== 'pending_payment') {
    return NextResponse.json(
      { error: 'Reservation status must be pending_payment' },
      { status: 400 }
    )
  }

  // Update reservation status and clear deposit expiration
  const { error: updateError } = await supabase
    .from('reservations')
    .update({
      status: 'confirmed',
      deposit_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenant.id as string)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Send confirmation email if guest email is present
  if (reservation.guest_email) {
    const emailData: ReservationEmailData = {
      guestName: reservation.guest_name,
      checkInDate: reservation.check_in_date,
      checkOutDate: reservation.check_out_date,
      roomType: reservation.room_type_id,
      hotelName: tenant.business_name || '',
      hotelPhone: tenant.phone || null,
      hotelAddress: tenant.address || null,
    }

    await sendReservationConfirmation(reservation.guest_email, emailData)
  }

  return NextResponse.json({ success: true })
}
