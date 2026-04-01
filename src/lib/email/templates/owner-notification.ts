export interface OwnerNotificationData {
  guestName: string
  guestPhone: string
  checkInDate: string
  checkOutDate?: string | null
  roomType?: string | null
  channel: 'phone' | 'chat' | 'manual'
  hotelName: string
}

const channelLabel: Record<string, string> = {
  phone: '📞 Телефонен AI асистент',
  chat: '💬 Chat widget',
  manual: '✋ Ръчно',
}

export function ownerNotificationHtml(data: OwnerNotificationData): string {
  const { guestName, guestPhone, checkInDate, checkOutDate, roomType, channel, hotelName } = data
  const dateRange = checkOutDate ? `${checkInDate} – ${checkOutDate}` : checkInDate

  return `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#111827;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">🏨 ${hotelName}</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,.6);font-size:13px;">Нова резервация от AI асистента</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#111;">Постъпи нова резервация:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
              <tr style="background:#f9fafb;">
                <td style="padding:11px 16px;font-size:13px;color:#666;width:38%;">Гост</td>
                <td style="padding:11px 16px;font-size:14px;color:#111;font-weight:600;">${guestName}</td>
              </tr>
              <tr>
                <td style="padding:11px 16px;font-size:13px;color:#666;border-top:1px solid #e5e7eb;">Телефон</td>
                <td style="padding:11px 16px;font-size:14px;color:#111;border-top:1px solid #e5e7eb;">${guestPhone}</td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="padding:11px 16px;font-size:13px;color:#666;border-top:1px solid #e5e7eb;">Дати</td>
                <td style="padding:11px 16px;font-size:14px;color:#111;font-weight:600;border-top:1px solid #e5e7eb;">${dateRange}</td>
              </tr>
              ${roomType ? `<tr>
                <td style="padding:11px 16px;font-size:13px;color:#666;border-top:1px solid #e5e7eb;">Стая</td>
                <td style="padding:11px 16px;font-size:14px;color:#111;border-top:1px solid #e5e7eb;">${roomType}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:11px 16px;font-size:13px;color:#666;border-top:1px solid #e5e7eb;">Канал</td>
                <td style="padding:11px 16px;font-size:14px;color:#6366f1;border-top:1px solid #e5e7eb;">${channelLabel[channel] || channel}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#999;text-align:center;">Автоматично известие от ReservAItion</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function ownerNotificationSubject(guestName: string, checkInDate: string): string {
  return `🔔 Нова резервация — ${guestName} (${checkInDate})`
}
