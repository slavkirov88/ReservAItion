export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateSystemPrompt } from '@/lib/ai/prompt-generator'
import Anthropic from '@anthropic-ai/sdk'
import { getAvailableRoomTypes, formatAvailabilityBg } from '@/lib/availability'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'placeholder' })

interface MessageParam {
  role: 'user' | 'assistant'
  content: string
}

const tools: Anthropic.Tool[] = [
  {
    name: 'get_available_room_types',
    description: 'Check which room types are available for specific dates. Always call this when the guest asks about availability or wants to book.',
    input_schema: {
      type: 'object' as const,
      properties: {
        check_in_date: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
        check_out_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
      },
      required: ['check_in_date', 'check_out_date'],
    },
  },
  {
    name: 'book_reservation',
    description: 'Book a hotel reservation',
    input_schema: {
      type: 'object' as const,
      properties: {
        guest_name: { type: 'string' },
        guest_phone: { type: 'string' },
        room_type: { type: 'string', description: 'Room type name' },
        check_in_date: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
        check_out_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
      },
      required: ['guest_name', 'guest_phone', 'room_type', 'check_in_date'],
    },
  },
]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ apiKey: string }> }
) {
  const { apiKey } = await params
  const { message, history = [] } = await request.json() as {
    message: string
    history: MessageParam[]
    sessionId?: string
  }

  const supabase = await createServiceClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name, languages, address, website_content')
    .eq('public_api_key', apiKey)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('faqs, booking_rules, welcome_message_bg')
    .eq('tenant_id', tenant.id)
    .single()

  const { data: roomTypesData } = await supabase
    .from('room_types')
    .select('name, capacity, price_per_night, description')
    .eq('tenant_id', tenant.id)

  const systemPrompt = generateSystemPrompt({
    business_name: tenant.business_name,
    address: tenant.address || '',
    room_types: roomTypesData || [],
    faqs: profile?.faqs || [],
    booking_rules: profile?.booking_rules || '',
    welcome_message_bg: profile?.welcome_message_bg || 'Здравейте!',
    website_content: tenant.website_content || undefined,
  }, tenant.languages || ['bg'])

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: message },
  ]

  // First pass — detect tool calls
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools,
  })

  if (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolCall of toolUseBlocks) {
      const args = toolCall.input as Record<string, string>

      if (toolCall.name === 'get_available_room_types') {
        const { check_in_date, check_out_date } = args
        if (!check_in_date || !check_out_date) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: 'Моля уточнете датите на настаняване и напускане.',
          })
        } else {
          const available = await getAvailableRoomTypes(supabase, tenant.id, check_in_date, check_out_date)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: formatAvailabilityBg(available, check_in_date, check_out_date),
          })
        }
      }

      if (toolCall.name === 'book_reservation') {
        if (!args.guest_name || !args.guest_phone || !args.check_in_date) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: 'Липсват задължителни полета за резервацията.',
          })
          continue
        }

        const { data: roomTypeData } = await supabase
          .from('room_types')
          .select('id, name')
          .eq('tenant_id', tenant.id)
          .ilike('name', args.room_type || '')
          .single()

        // Check real availability before booking
        if (args.check_out_date) {
          const available = await getAvailableRoomTypes(supabase, tenant.id, args.check_in_date, args.check_out_date)
          const requestedType = available.find(r => roomTypeData ? r.id === roomTypeData.id : true)
          if (roomTypeData && !requestedType) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: `За съжаление ${roomTypeData.name} е заета за ${args.check_in_date} – ${args.check_out_date}. ${available.length > 0 ? `Свободни са: ${available.map(r => r.name).join(', ')}.` : 'Няма свободни стаи за този период.'}`,
            })
            continue
          }
        }

        const { data: reservation, error } = await supabase
          .from('reservations')
          .insert({
            tenant_id: tenant.id,
            guest_name: args.guest_name,
            guest_phone: args.guest_phone,
            check_in_date: args.check_in_date,
            check_out_date: args.check_out_date || null,
            room_type_id: roomTypeData?.id || null,
            status: 'confirmed',
            channel: 'chat',
          })
          .select('id')
          .single()

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: error || !reservation
            ? 'Грешка при резервацията.'
            : `Резервацията е потвърдена! ID: ${reservation.id}`,
        })
      }
    }

    // Stream final response after tool execution
    const finalStream = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ],
      stream: true,
    })

    return streamResponse(finalStream)
  }

  // No tool calls — stream directly
  const stream = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools,
    stream: true,
  })

  return streamResponse(stream)
}

async function streamResponse(stream: AsyncIterable<Anthropic.MessageStreamEvent>) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
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
