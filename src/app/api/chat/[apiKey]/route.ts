export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateSystemPrompt } from '@/lib/ai/prompt-generator'
import Anthropic from '@anthropic-ai/sdk'
import { getAvailableRoomTypes, formatAvailabilityBg } from '@/lib/availability'
import { sendReservationConfirmation, sendOwnerNotification, sendProformaToGuest, sendDepositOwnerNotification } from '@/lib/email/resend'

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
        guest_email: { type: 'string', description: 'Email адрес на госта за проформа фактура' },
        total_amount: { type: 'number', description: 'Обща сума на резервацията в EUR за изчисляване на капаро' },
        room_type_name: { type: 'string', description: 'Наименование на стаята' },
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
      const args = toolCall.input as Record<string, unknown>

      if (toolCall.name === 'get_available_room_types') {
        const check_in_date = args.check_in_date as string | undefined
        const check_out_date = args.check_out_date as string | undefined
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
        const bookGuestName = args.guest_name as string | undefined
        const bookGuestPhone = args.guest_phone as string | undefined
        const bookCheckin = args.check_in_date as string | undefined
        const bookCheckout = args.check_out_date as string | undefined
        const bookRoomType = args.room_type as string | undefined
        if (!bookGuestName || !bookGuestPhone || !bookCheckin) {
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
          .ilike('name', bookRoomType || '')
          .single()

        // Check real availability before booking
        if (bookCheckout) {
          const available = await getAvailableRoomTypes(supabase, tenant.id, bookCheckin, bookCheckout)
          const requestedType = available.find(r => roomTypeData ? r.id === roomTypeData.id : true)
          if (roomTypeData && !requestedType) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: `За съжаление ${roomTypeData.name} е заета за ${bookCheckin} – ${bookCheckout}. ${available.length > 0 ? `Свободни са: ${available.map(r => r.name).join(', ')}.` : 'Няма свободни стаи за този период.'}`,
            })
            continue
          }
        }

        const guestEmail = args.guest_email as string | undefined
        const totalAmount = args.total_amount ? Number(args.total_amount) : undefined
        const roomTypeName = (args.room_type_name as string | undefined) || bookRoomType

        const { data: tenantFull } = await supabase
          .from('tenants')
          .select('bank_iban, bank_name, company_name, company_address, deposit_percent, business_name, phone, address, owner_id')
          .eq('id', tenant.id)
          .single()

        const { data: reservation, error } = await supabase
          .from('reservations')
          .insert({
            tenant_id: tenant.id,
            guest_name: bookGuestName,
            guest_phone: bookGuestPhone,
            check_in_date: bookCheckin,
            check_out_date: bookCheckout || null,
            room_type_id: roomTypeData?.id || null,
            status: 'confirmed',
            channel: 'chat',
          })
          .select('id')
          .single()

        if (error || !reservation) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: 'Грешка при резервацията.',
          })
          continue
        }

        const hasDepositFlow =
          guestEmail &&
          totalAmount && totalAmount > 0 &&
          tenantFull?.bank_iban &&
          tenantFull?.company_name

        if (hasDepositFlow && totalAmount && tenantFull) {
          const depositPercent = tenantFull.deposit_percent ?? 30
          const depositAmount = Math.round(totalAmount * depositPercent / 100 * 100) / 100
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

          await supabase
            .from('reservations')
            .update({
              status: 'pending_payment',
              guest_email: guestEmail,
              total_amount: totalAmount,
              deposit_amount: depositAmount,
              deposit_expires_at: expiresAt,
            })
            .eq('id', reservation.id)

          const deadlineFormatted = new Date(expiresAt).toLocaleDateString('bg-BG', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })

          await sendProformaToGuest(guestEmail, {
            guestName: bookGuestName,
            roomTypeName: roomTypeName || '',
            checkInDate: bookCheckin,
            checkOutDate: bookCheckout || '',
            totalAmount,
            depositAmount,
            depositPercent,
            deadlineDate: deadlineFormatted,
            hotelName: tenantFull.business_name || 'Хотел',
            companyName: tenantFull.company_name as string,
            companyAddress: (tenantFull.company_address as string | null) || '',
            bankIban: tenantFull.bank_iban as string,
            bankName: (tenantFull.bank_name as string | null) || '',
          })

          if (tenantFull.owner_id) {
            const { data: ownerData } = await supabase.auth.admin.getUserById(tenantFull.owner_id)
            if (ownerData?.user?.email) {
              await sendDepositOwnerNotification(ownerData.user.email, {
                guestName: bookGuestName,
                guestEmail,
                guestPhone: bookGuestPhone,
                roomTypeName: roomTypeName || '',
                checkInDate: bookCheckin,
                checkOutDate: bookCheckout || '',
                totalAmount,
                depositAmount,
                deadlineDate: deadlineFormatted,
              })
            }
          }
        } else if (tenantFull) {
          if (guestEmail) {
            await sendReservationConfirmation(guestEmail, {
              guestName: bookGuestName,
              checkInDate: bookCheckin,
              checkOutDate: bookCheckout || null,
              roomType: bookRoomType || null,
              hotelName: tenantFull.business_name ?? 'Хотел',
              hotelPhone: (tenantFull.phone as string | null) ?? null,
              hotelAddress: (tenantFull.address as string | null) ?? null,
            })
          }

          if (tenantFull.owner_id) {
            const { data: ownerData } = await supabase.auth.admin.getUserById(tenantFull.owner_id)
            if (ownerData?.user?.email) {
              await sendOwnerNotification(ownerData.user.email, {
                guestName: bookGuestName,
                guestPhone: bookGuestPhone,
                checkInDate: bookCheckin,
                checkOutDate: bookCheckout || null,
                roomType: bookRoomType || null,
                channel: 'chat',
                hotelName: tenantFull.business_name ?? 'Хотел',
              })
            }
          }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: `Резервацията е потвърдена! ID: ${reservation.id}`,
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
