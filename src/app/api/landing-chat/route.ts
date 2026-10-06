export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { LANDING_CHAT_PROMPT } from '@/lib/landing-chat/prompt'
import { MAX_MESSAGE_CHARS, rateLimited, sanitizeHistory, validateChatLead } from '@/lib/landing-chat/sanitize'
import { sendTelegram } from '@/lib/lead-notify'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder' })
const MODEL = 'claude-haiku-4-5'

const tools: Anthropic.Tool[] = [
  {
    name: 'request_demo',
    description:
      'Record a request for a free demo call. Call it once, only after the visitor has given name, phone, email and the property name with its number of rooms.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Visitor name' },
        phone: { type: 'string', description: 'Phone number' },
        email: { type: 'string', description: 'Email address' },
        property: { type: 'string', description: 'Property name and number of rooms or units' },
        summary: { type: 'string', description: 'One short sentence on what the visitor asked about' },
      },
      required: ['name', 'phone', 'email', 'property'],
    },
  },
]

// The prompt is in Bulgarian, which pulls short English questions into Bulgarian answers.
// Decide the language here instead of trusting the model.
// Looks at everything the visitor wrote, so an email or phone number alone does not flip the language.
function systemFor(visitorText: string) {
  const english = /[A-Za-z]/.test(visitorText) && !/[Ѐ-ӿ]/.test(visitorText)
  return english
    ? `${LANDING_CHAT_PROMPT}\n\nThe visitor is writing in English. Reply ONLY in English, using "you". Do not use Bulgarian words.`
    : LANDING_CHAT_PROMPT
}

const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: { message?: unknown; history?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : ''
  if (!message) return NextResponse.json({ error: 'empty' }, { status: 400 })

  const messages: Anthropic.MessageParam[] = [...sanitizeHistory(body.history), { role: 'user', content: message }]

  const system = systemFor(
    messages.filter((m) => m.role === 'user' && typeof m.content === 'string').map((m) => m.content as string).join(' ')
  )

  try {
    const first = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      messages,
      tools,
    })

    let leadSaved = false
    let finalMessages = messages

    if (first.stop_reason === 'tool_use') {
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of first.content) {
        if (block.type !== 'tool_use') continue
        let content = 'Грешка: липсват данни.'
        if (block.name === 'request_demo') {
          const args = block.input as Record<string, unknown>
          const parsed = validateChatLead(args)
          if (!parsed.ok) {
            content = 'Данните не са валидни. Поискай отново телефона или имейла.'
          } else {
            const d = parsed.data
            const ok = await sendTelegram('Нов лид ReservAItion (чат)', {
              Име: d.name,
              Телефон: d.phone,
              Имейл: d.email,
              Обект: d.property,
              Интерес: typeof args.summary === 'string' ? args.summary.slice(0, 300) : '',
              Код: d.leadId.slice(0, 8),
            })
            if (ok) {
              leadSaved = true
              content = 'Успех: данните са записани.'
            } else {
              console.error('LEAD_UNDELIVERED chat', JSON.stringify(d))
              content = 'Грешка: данните не бяха записани. Посочи формата или демо номера.'
            }
          }
        }
        results.push({ type: 'tool_result', tool_use_id: block.id, content })
      }
      finalMessages = [
        ...messages,
        { role: 'assistant', content: first.content },
        { role: 'user', content: results },
      ]
    } else {
      // No tool call: reuse the answer that was already generated.
      const text = first.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
      return streamText(text, false)
    }

    const stream = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      messages: finalMessages,
      tools,
      stream: true,
    })
    return streamEvents(stream, leadSaved)
  } catch (err) {
    console.error('landing-chat failed', err)
    return NextResponse.json({ error: 'upstream_failed' }, { status: 502 })
  }
}

const headers = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
}

function streamText(text: string, lead: boolean) {
  const enc = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(c) {
        if (lead) c.enqueue(enc.encode(sse({ lead: true })))
        c.enqueue(enc.encode(sse({ text })))
        c.enqueue(enc.encode('data: [DONE]\n\n'))
        c.close()
      },
    }),
    { headers }
  )
}

function streamEvents(stream: AsyncIterable<Anthropic.MessageStreamEvent>, lead: boolean) {
  const enc = new TextEncoder()
  return new Response(
    new ReadableStream({
      async start(c) {
        if (lead) c.enqueue(enc.encode(sse({ lead: true })))
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            c.enqueue(enc.encode(sse({ text: event.delta.text })))
          }
        }
        c.enqueue(enc.encode('data: [DONE]\n\n'))
        c.close()
      },
    }),
    { headers }
  )
}
