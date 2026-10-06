import { NextRequest, NextResponse } from 'next/server'
import { sendTelegram } from '@/lib/lead-notify'
import { parseLeadPayload } from '@/lib/lead-payload'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const parsed = parseLeadPayload(body)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
  }
  const d = parsed.data

  const delivered = await sendTelegram('Нов лид ReservAItion (/razgovor)', {
    Име: d.name,
    Телефон: d.phone,
    Имейл: d.email,
    Обект: d.property,
    Код: d.leadId.slice(0, 8),
  })

  if (!delivered) {
    console.error('LEAD_UNDELIVERED razgovor', JSON.stringify(d))
    return NextResponse.json({ ok: false, error: 'upstream_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
