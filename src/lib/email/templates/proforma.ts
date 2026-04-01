export interface ProformaEmailData {
  guestName: string
  roomTypeName: string
  checkInDate: string
  checkOutDate: string
  totalAmount: number
  depositAmount: number
  depositPercent: number
  deadlineDate: string
  hotelName: string
  companyName: string
  companyAddress: string
  bankIban: string
  bankName: string
}

export interface DepositOwnerNotificationData {
  guestName: string
  guestEmail: string
  guestPhone: string
  roomTypeName: string
  checkInDate: string
  checkOutDate: string
  totalAmount: number
  depositAmount: number
  deadlineDate: string
}

export function proformaSubject(hotelName: string): string {
  return `Проформа фактура — ${hotelName}`
}

export function proformaHtml(d: ProformaEmailData): string {
  return `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  h1 { color: #1a1a2e; font-size: 22px; }
  h2 { color: #444; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 4px; border-bottom: 1px solid #f0f0f0; }
  td:first-child { color: #666; width: 45%; }
  .amount { font-size: 20px; font-weight: bold; color: #1a1a2e; }
  .bank-box { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .deadline { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0; }
  .footer { font-size: 12px; color: #999; margin-top: 32px; }
</style></head>
<body>
  <h1>Проформа фактура</h1>
  <p>Уважаеми/а <strong>${d.guestName}</strong>,</p>
  <p>Благодарим Ви за резервацията в <strong>${d.hotelName}</strong>. Моля, извършете плащане на капарото в рамките на 48 часа за потвърждение на резервацията.</p>

  <h2>Детайли на резервацията</h2>
  <table>
    <tr><td>Стая</td><td>${d.roomTypeName}</td></tr>
    <tr><td>Настаняване</td><td>${d.checkInDate}</td></tr>
    <tr><td>Напускане</td><td>${d.checkOutDate}</td></tr>
    <tr><td>Обща сума</td><td>${d.totalAmount.toFixed(2)} EUR</td></tr>
    <tr><td>Капаро (${d.depositPercent}%)</td><td class="amount">${d.depositAmount.toFixed(2)} EUR</td></tr>
  </table>

  <div class="deadline">
    ⏰ <strong>Краен срок за плащане: ${d.deadlineDate}</strong><br>
    При неплащане в срок резервацията се анулира автоматично.
  </div>

  <div class="bank-box">
    <h2 style="border:none;margin-top:0;">Банкови данни за превод</h2>
    <table>
      <tr><td>Получател</td><td><strong>${d.companyName}</strong></td></tr>
      <tr><td>Адрес</td><td>${d.companyAddress}</td></tr>
      <tr><td>IBAN</td><td><strong>${d.bankIban}</strong></td></tr>
      <tr><td>Банка</td><td>${d.bankName}</td></tr>
      <tr><td>Основание</td><td>Капаро — ${d.guestName} — ${d.checkInDate}</td></tr>
      <tr><td>Сума</td><td><strong>${d.depositAmount.toFixed(2)} EUR</strong></td></tr>
    </table>
  </div>

  <p>При въпроси не се колебайте да се свържете с нас.</p>
  <p>С уважение,<br><strong>${d.hotelName}</strong></p>
  <div class="footer">Powered by ReservAItion</div>
</body>
</html>`
}

export function depositOwnerNotificationSubject(guestName: string): string {
  return `Нова резервация чака капаро — ${guestName}`
}

export function depositOwnerNotificationHtml(d: DepositOwnerNotificationData): string {
  return `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  h1 { color: #1a1a2e; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 4px; border-bottom: 1px solid #f0f0f0; }
  td:first-child { color: #666; width: 45%; }
  .amount { font-weight: bold; color: #1a1a2e; }
  .deadline { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0; }
</style></head>
<body>
  <h1>Нова резервация чака капаро</h1>
  <table>
    <tr><td>Гост</td><td><strong>${d.guestName}</strong></td></tr>
    <tr><td>Имейл</td><td>${d.guestEmail}</td></tr>
    <tr><td>Телефон</td><td>${d.guestPhone}</td></tr>
    <tr><td>Стая</td><td>${d.roomTypeName}</td></tr>
    <tr><td>Настаняване</td><td>${d.checkInDate}</td></tr>
    <tr><td>Напускане</td><td>${d.checkOutDate}</td></tr>
    <tr><td>Обща сума</td><td>${d.totalAmount.toFixed(2)} EUR</td></tr>
    <tr><td>Капаро</td><td class="amount">${d.depositAmount.toFixed(2)} EUR</td></tr>
  </table>
  <div class="deadline">⏰ Краен срок за потвърждение: <strong>${d.deadlineDate}</strong></div>
  <p>Влезте в панела, за да потвърдите плащането след получаване на превода.</p>
</body>
</html>`
}
