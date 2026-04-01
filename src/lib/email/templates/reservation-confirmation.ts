export interface ReservationEmailData {
  guestName: string
  checkInDate: string
  checkOutDate?: string | null
  roomType?: string | null
  hotelName: string
  hotelPhone?: string | null
  hotelAddress?: string | null
}

export function reservationConfirmationHtml(data: ReservationEmailData): string {
  const { guestName, checkInDate, checkOutDate, roomType, hotelName, hotelPhone, hotelAddress } = data

  const dateRange = checkOutDate
    ? `${checkInDate} – ${checkOutDate}`
    : checkInDate

  return `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Потвърждение на резервация</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="background:#6366f1;padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${hotelName}</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Потвърждение на резервация</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111;">Уважаеми/а <strong>${guestName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#444;">Резервацията Ви е потвърдена. По-долу са детайлите:</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                <tr style="background:#f9fafb;">
                  <td style="padding:12px 16px;font-size:13px;color:#666;width:40%;">Дати</td>
                  <td style="padding:12px 16px;font-size:14px;color:#111;font-weight:600;">${dateRange}</td>
                </tr>
                ${roomType ? `<tr>
                  <td style="padding:12px 16px;font-size:13px;color:#666;border-top:1px solid #e5e7eb;">Тип стая</td>
                  <td style="padding:12px 16px;font-size:14px;color:#111;border-top:1px solid #e5e7eb;">${roomType}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:12px 16px;font-size:13px;color:#666;border-top:1px solid #e5e7eb;">Статус</td>
                  <td style="padding:12px 16px;font-size:14px;color:#16a34a;font-weight:600;border-top:1px solid #e5e7eb;">✓ Потвърдена</td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#444;">При въпроси се свържете с нас:</p>
              ${hotelPhone ? `<p style="margin:0 0 4px;font-size:14px;color:#111;">📞 ${hotelPhone}</p>` : ''}
              ${hotelAddress ? `<p style="margin:0;font-size:14px;color:#111;">📍 ${hotelAddress}</p>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#999;text-align:center;">Това е автоматично съобщение от ${hotelName}. Моля не отговаряйте на него.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function reservationConfirmationSubject(hotelName: string): string {
  return `Потвърждение на резервация — ${hotelName}`
}
