import { Resend } from 'resend'
import {
  reservationConfirmationHtml,
  reservationConfirmationSubject,
  type ReservationEmailData,
} from './templates/reservation-confirmation'
import {
  ownerNotificationHtml,
  ownerNotificationSubject,
  type OwnerNotificationData,
} from './templates/owner-notification'
import {
  proformaHtml,
  proformaSubject,
  depositOwnerNotificationHtml,
  depositOwnerNotificationSubject,
  type ProformaEmailData,
  type DepositOwnerNotificationData,
} from './templates/proforma'

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY is not set — skipping email send.')
    return null
  }
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendReservationConfirmation(
  toEmail: string,
  data: ReservationEmailData
): Promise<void> {
  const resend = getResendClient()
  if (!resend) return

  try {
    await resend.emails.send({
      from: `${data.hotelName} <reservations@reservaition.com>`,
      to: toEmail,
      subject: reservationConfirmationSubject(data.hotelName),
      html: reservationConfirmationHtml(data),
    })
  } catch (err) {
    console.error('[Email] Failed to send reservation confirmation:', err)
  }
}

export async function sendOwnerNotification(
  ownerEmail: string,
  data: OwnerNotificationData
): Promise<void> {
  const resend = getResendClient()
  if (!resend) return

  try {
    await resend.emails.send({
      from: 'ReservAItion <notifications@reservaition.com>',
      to: ownerEmail,
      subject: ownerNotificationSubject(data.guestName, data.checkInDate),
      html: ownerNotificationHtml(data),
    })
  } catch (err) {
    console.error('[Email] Failed to send owner notification:', err)
  }
}

export async function sendProformaToGuest(
  toEmail: string,
  data: ProformaEmailData
): Promise<void> {
  const resend = getResendClient()
  if (!resend) return
  try {
    await resend.emails.send({
      from: `${data.hotelName} <reservations@reservaition.com>`,
      to: toEmail,
      subject: proformaSubject(data.hotelName),
      html: proformaHtml(data),
    })
  } catch (err) {
    console.error('[Email] Failed to send proforma:', err)
  }
}

export async function sendDepositOwnerNotification(
  ownerEmail: string,
  data: DepositOwnerNotificationData
): Promise<void> {
  const resend = getResendClient()
  if (!resend) return
  try {
    await resend.emails.send({
      from: 'ReservAItion <notifications@reservaition.com>',
      to: ownerEmail,
      subject: depositOwnerNotificationSubject(data.guestName),
      html: depositOwnerNotificationHtml(data),
    })
  } catch (err) {
    console.error('[Email] Failed to send deposit owner notification:', err)
  }
}
