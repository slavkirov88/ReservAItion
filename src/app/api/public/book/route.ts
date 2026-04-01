import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendReservationConfirmation, sendOwnerNotification, sendProformaToGuest, sendDepositOwnerNotification } from '@/lib/email/resend'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      api_key,
      guest_name,
      guest_phone,
      guest_email,
      service,
      starts_at,
      check_in_date,
      check_out_date,
      room_type,
      total_amount,
      room_type_name,
    }: {
      api_key: string
      guest_name: string
      guest_phone: string
      guest_email?: string
      service?: string
      starts_at?: string
      check_in_date?: string
      check_out_date?: string
      room_type?: string
      total_amount?: number | string
      room_type_name?: string
    } = body

    const effectiveCheckin = check_in_date || starts_at
    const effectiveCheckout = check_out_date || null
    const effectiveService = room_type || service || null
    if (!api_key || !guest_name || !guest_phone || !effectiveCheckin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, business_name, phone, address, owner_id, bank_iban, bank_name, company_name, company_address, deposit_percent')
      .eq('public_api_key', api_key)
      .single()

    if (!tenant) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

    // Check slot is still available
    const { data: existing } = await supabase
      .from('reservations')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('check_in_date', effectiveCheckin)
      .in('status', ['confirmed', 'pending_payment'])
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 })
    }

    const { data: appointment, error } = await supabase
      .from('reservations')
      .insert({
        tenant_id: tenant.id,
        guest_name,
        guest_phone,
        notes: effectiveService,
        check_in_date: effectiveCheckin,
        check_out_date: effectiveCheckout,
        status: 'confirmed',
        channel: 'chat',
      })
      .select('id')
      .single()

    if (error) throw error

    const t = tenant as {
      id: string
      business_name?: string
      phone?: string
      address?: string
      owner_id?: string
      bank_iban?: string | null
      bank_name?: string | null
      company_name?: string | null
      company_address?: string | null
      deposit_percent?: number | null
    }

    // Resolve owner email once
    let ownerEmail: string | undefined
    if (t.owner_id) {
      const { data: ownerData } = await supabase.auth.admin.getUserById(t.owner_id)
      ownerEmail = ownerData?.user?.email ?? undefined
    }

    const guestEmailVal: string | undefined = guest_email
    const totalAmountVal: number | undefined = total_amount ? Number(total_amount) : undefined

    const hasDepositFlow =
      guestEmailVal &&
      totalAmountVal && totalAmountVal > 0 &&
      t.bank_iban &&
      t.company_name

    if (hasDepositFlow && totalAmountVal) {
      const depositPercent = t.deposit_percent ?? 30
      const depositAmount = Math.round(totalAmountVal * depositPercent / 100 * 100) / 100
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

      await supabase
        .from('reservations')
        .update({
          status: 'pending_payment',
          guest_email: guestEmailVal,
          total_amount: totalAmountVal,
          deposit_amount: depositAmount,
          deposit_expires_at: expiresAt,
        })
        .eq('id', appointment.id)

      const deadlineFormatted = new Date(expiresAt).toLocaleDateString('bg-BG', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })

      await sendProformaToGuest(guestEmailVal, {
        guestName: guest_name,
        roomTypeName: room_type_name || room_type || '',
        checkInDate: effectiveCheckin,
        checkOutDate: effectiveCheckout || '',
        totalAmount: totalAmountVal,
        depositAmount,
        depositPercent,
        deadlineDate: deadlineFormatted,
        hotelName: t.business_name || 'Хотел',
        companyName: t.company_name as string,
        companyAddress: (t.company_address as string | null) || '',
        bankIban: t.bank_iban as string,
        bankName: (t.bank_name as string | null) || '',
      })

      // Send owner notification about pending deposit
      if (ownerEmail) {
        await sendDepositOwnerNotification(ownerEmail, {
          guestName: guest_name,
          guestEmail: guestEmailVal,
          guestPhone: guest_phone || '',
          roomTypeName: room_type_name || room_type || '',
          checkInDate: effectiveCheckin,
          checkOutDate: effectiveCheckout || '',
          totalAmount: totalAmountVal,
          depositAmount,
          deadlineDate: deadlineFormatted,
        })
      }
    } else {
      // Legacy flow — no deposit, use existing email functions
      if (guestEmailVal) {
        await sendReservationConfirmation(guestEmailVal, {
          guestName: guest_name,
          checkInDate: effectiveCheckin,
          checkOutDate: effectiveCheckout,
          roomType: effectiveService,
          hotelName: t.business_name ?? 'Хотел',
          hotelPhone: t.phone ?? null,
          hotelAddress: t.address ?? null,
        })
      }

      if (ownerEmail) {
        await sendOwnerNotification(ownerEmail, {
          guestName: guest_name,
          guestPhone: guest_phone,
          checkInDate: effectiveCheckin,
          checkOutDate: effectiveCheckout,
          roomType: effectiveService,
          channel: 'chat',
          hotelName: t.business_name ?? 'Хотел',
        })
      }
    }

    return NextResponse.json({ appointment_id: appointment.id, confirmation: 'Резервацията е потвърдена!' })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
