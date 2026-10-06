// Lead delivery straight to Telegram, so a lead is never lost to a third-party
// automation being down. Copied from slavkirov.com; no n8n path here.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function sendTelegram(
  title: string,
  fields: Record<string, string>
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  const lines = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`)
  const text = `<b>${esc(title)}</b>\n\n${lines.join('\n')}`

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}
