import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const now = new Date().toISOString()

  // Find expired on_hold reservations
  const { data: expired } = await supabase
    .from('room_reservations')
    .select('id, invoice_id, guest_email, guest_name')
    .eq('status', 'on_hold')
    .lt('held_until', now)

  if (!expired || expired.length === 0) {
    return new Response('No expired reservations', { status: 200 })
  }

  const results: string[] = []

  for (const reservation of expired) {
    // Cancel reservation
    await supabase.from('room_reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservation.id)

    // Mark invoice expired
    if (reservation.invoice_id) {
      await supabase.from('invoices')
        .update({ status: 'expired' })
        .eq('id', reservation.invoice_id)
        .eq('status', 'sent') // only if not already paid
    }

    // Send cancellation email via Resend
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@hotelai.app',
          to: reservation.guest_email,
          subject: 'Резервацията е отменена — изтекъл срок за плащане',
          html: `<p>Уважаеми ${reservation.guest_name}, резервацията ви е автоматично отменена поради неплащане в 48-часовия срок. Моля свържете се с нас, за да направите нова резервация.</p>`,
        }),
      })
      if (!emailRes.ok) {
        console.error(`Resend failed for ${reservation.id}: ${await emailRes.text()}`)
      }
    } catch (err) {
      console.error(`Email error for ${reservation.id}:`, err)
    }

    results.push(`Cancelled: ${reservation.id}`)
  }

  return new Response(results.join('\n'), { status: 200 })
})
