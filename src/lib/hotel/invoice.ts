import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createElement, type ReactElement, type JSXElementConstructor } from 'react'
import { Resend } from 'resend'
import { InvoicePDF } from '@/components/hotel/InvoicePDF'
import type { InvoiceEmailData } from '@/types/hotel'

const resend = new Resend(process.env.RESEND_API_KEY)

export type InvoiceData = InvoiceEmailData

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const element = createElement(InvoicePDF, data) as ReactElement<DocumentProps, string | JSXElementConstructor<unknown>>
  return await renderToBuffer(element)
}

export async function sendInvoiceEmail(
  data: InvoiceData,
  pdfBuffer: Buffer
): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@hotelai.app',
    to: data.guestEmail,
    subject: `Вашата резервация в ${data.hotelName} — Фактура #${data.invoiceNumber} — Платете в рамките на 48 часа`,
    html: buildEmailHtml(data),
    attachments: [{
      filename: `invoice-${data.invoiceNumber}.pdf`,
      content: pdfBuffer.toString('base64'),
    }],
  })
  if (error) throw new Error(`Failed to send invoice email: ${error.message}`)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildEmailHtml(data: InvoiceData): string {
  return `
    <h2>Вашата резервация в ${escapeHtml(data.hotelName)}</h2>
    <p>Уважаеми ${escapeHtml(data.guestName)},</p>
    <p>Получавате фактура за вашата резервация. Моля, платете в рамките на 48 часа, за да потвърдите резервацията.</p>
    <table>
      <tr><td><strong>Стая:</strong></td><td>${escapeHtml(data.roomName)}</td></tr>
      <tr><td><strong>Настаняване:</strong></td><td>${escapeHtml(data.checkIn)}</td></tr>
      <tr><td><strong>Напускане:</strong></td><td>${escapeHtml(data.checkOut)}</td></tr>
      <tr><td><strong>Нощувки:</strong></td><td>${data.nights}</td></tr>
      <tr><td><strong>Обща сума:</strong></td><td>${data.totalPrice} ${data.currency}</td></tr>
    </table>
    <p><a href="${escapeHtml(data.stripePaymentLink)}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px">Платете онлайн</a></p>
    ${data.iban ? `<p>Банков превод: IBAN ${escapeHtml(data.iban)}</p>` : ''}
    <p><strong>Краен срок за плащане: ${new Date(data.expiresAt).toLocaleString('bg-BG')}</strong></p>
    <p>При неплащане в срок резервацията ще бъде автоматично отменена.</p>
  `
}

export function generateInvoiceNumber(sequenceId: number): string {
  const year = new Date().getFullYear()
  return `INV-${year}-${String(sequenceId).padStart(4, '0')}`
}
