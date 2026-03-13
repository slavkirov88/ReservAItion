import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateSystemPrompt } from '@/lib/ai/prompt-generator'
import { generateSlots } from '@/lib/scheduling/slot-generator'
import { chatRateLimit, checkRateLimit } from '@/lib/rate-limit'
import type { ScheduleRuleRow } from '@/types/database'
import OpenAI from 'openai'
import { addMinutes, parseISO, format } from 'date-fns'

// Suppress unused import warning
void format

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface BookedRow {
  starts_at: string
  ends_at: string
}

interface ChatToolCall {
  id: string
  function: {
    name: string
    arguments: string
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ apiKey: string }> }
) {
  const { apiKey } = await params
  const { message, history = [], sessionId } = await request.json() as {
    message: string
    history: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    sessionId?: string
  }

  const rateLimitResponse = await checkRateLimit(chatRateLimit, sessionId || apiKey)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createServiceClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, languages, address')
    .eq('public_api_key', apiKey)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('services, faqs, booking_rules, welcome_message_bg')
    .eq('tenant_id', tenant.id)
    .single()

  const systemPrompt = generateSystemPrompt({
    business_name: tenant.business_name,
    address: tenant.address || '',
    services: profile?.services || [],
    faqs: profile?.faqs || [],
    booking_rules: profile?.booking_rules || '',
    welcome_message_bg: profile?.welcome_message_bg || 'Здравейте!',
  }, tenant.languages || ['bg'])

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'get_available_slots',
        description: 'Get available appointment slots for a given date',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          },
          required: ['date'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'book_appointment',
        description: 'Book an appointment',
        parameters: {
          type: 'object',
          properties: {
            patient_name: { type: 'string' },
            patient_phone: { type: 'string' },
            service: { type: 'string' },
            starts_at: { type: 'string', description: 'ISO datetime' },
          },
          required: ['patient_name', 'patient_phone', 'service', 'starts_at'],
        },
      },
    },
  ]

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ]

  // Non-streaming first pass to detect tool calls
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    tools,
    stream: false,
  })

  const choice = response.choices[0]

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = []

    for (const rawToolCall of choice.message.tool_calls) {
      const toolCall = rawToolCall as unknown as ChatToolCall
      const args = JSON.parse(toolCall.function.arguments) as Record<string, string>

      if (toolCall.function.name === 'get_available_slots') {
        const dateStr = args.date
        const dateObj = new Date(dateStr)
        const dayOfWeek = dateObj.getDay()

        const { data: ruleData } = await supabase
          .from('schedule_rules')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('day_of_week', dayOfWeek)
          .eq('is_active', true)
          .single()

        const rule = ruleData as ScheduleRuleRow | null

        if (!rule) {
          toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: 'Няма работно време.' })
          continue
        }

        const { data: booked } = await supabase
          .from('appointments')
          .select('starts_at, ends_at')
          .eq('tenant_id', tenant.id)
          .gte('starts_at', `${dateStr}T00:00:00`)
          .lte('starts_at', `${dateStr}T23:59:59`)
          .in('status', ['confirmed'])

        const slots = generateSlots(dateStr, {
          start_time: rule.start_time,
          end_time: rule.end_time,
          slot_duration_min: rule.slot_duration_min,
          break_start: rule.break_start,
          break_end: rule.break_end,
        }, (booked || []) as BookedRow[])

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: slots.length > 0
            ? `Свободни часове: ${slots.join(', ')}`
            : 'Няма свободни часове.',
        })
      }

      if (toolCall.function.name === 'book_appointment') {
        const startDate = parseISO(args.starts_at)
        const dayOfWeek = startDate.getDay()

        const { data: slotRule } = await supabase
          .from('schedule_rules')
          .select('slot_duration_min')
          .eq('tenant_id', tenant.id)
          .eq('day_of_week', dayOfWeek)
          .single()

        const slotDuration = (slotRule as { slot_duration_min?: number } | null)?.slot_duration_min || 30
        const endsAt = addMinutes(startDate, slotDuration).toISOString()

        const { data: appointment, error } = await supabase
          .from('appointments')
          .insert({
            tenant_id: tenant.id,
            patient_name: args.patient_name,
            patient_phone: args.patient_phone,
            service: args.service,
            starts_at: args.starts_at,
            ends_at: endsAt,
            status: 'confirmed',
            channel: 'chat',
          })
          .select('id')
          .single()

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: error || !appointment
            ? 'Грешка при записването.'
            : `Часът е записан! ID: ${appointment.id}`,
        })
      }
    }

    const finalStream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [...messages, choice.message, ...toolResults],
      stream: true,
    })

    return streamResponse(finalStream)
  }

  // No tool calls — stream directly
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    stream: true,
  })

  return streamResponse(stream)
}

function streamResponse(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ''
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  )
}
