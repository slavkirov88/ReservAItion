import { generateSystemPrompt } from '@/lib/ai/prompt-generator'

export interface VapiTenant {
  id: string
  business_name: string
  languages: string[]
}

export interface VapiProfile {
  room_types: Array<{ name: string; capacity: number; price_per_night: number }>
  faqs: Array<{ question: string; answer: string }>
  booking_rules: string
  welcome_message_bg: string
  address: string
}

export async function createVapiAssistant(
  tenant: VapiTenant,
  profile: VapiProfile
): Promise<{ assistantId: string }> {
  const systemPrompt = generateSystemPrompt({
    business_name: tenant.business_name,
    address: profile.address || '',
    room_types: profile.room_types || [],
    faqs: profile.faqs || [],
    booking_rules: profile.booking_rules || '',
    welcome_message_bg: profile.welcome_message_bg,
  }, tenant.languages || ['bg'])

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `ReservAItion - ${tenant.business_name}`,
      voice: {
        provider: 'azure',
        voiceId: 'bg-BG-BorislavNeural',
      },
      transcriber: {
        provider: 'deepgram',
        language: 'bg',
        model: 'nova-2',
      },
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        tools: buildVapiTools(tenant.id, baseUrl),
      },
      firstMessage: profile.welcome_message_bg,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Vapi error: ${err}`)
  }

  const assistant = await response.json() as { id: string }
  return { assistantId: assistant.id }
}

export async function updateVapiAssistant(
  assistantId: string,
  tenant: VapiTenant,
  profile: VapiProfile
): Promise<void> {
  const systemPrompt = generateSystemPrompt({
    business_name: tenant.business_name,
    address: profile.address || '',
    room_types: profile.room_types || [],
    faqs: profile.faqs || [],
    booking_rules: profile.booking_rules || '',
    welcome_message_bg: profile.welcome_message_bg,
  }, tenant.languages || ['bg'])

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        tools: buildVapiTools(tenant.id, baseUrl),
      },
      firstMessage: profile.welcome_message_bg,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Vapi update error: ${err}`)
  }
}

export async function deleteVapiAssistant(assistantId: string): Promise<void> {
  await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}` },
  })
}

interface VapiToolParameter {
  type: string
  description: string
}

interface VapiTool {
  type: string
  function: {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, VapiToolParameter>
      required: string[]
    }
  }
  server: { url: string }
}

function buildVapiTools(tenantId: string, baseUrl: string): VapiTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'get_available_room_types',
        description: 'Get available room types with prices and capacity',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      server: { url: `${baseUrl}/api/vapi/${tenantId}/tool-call` },
    },
    {
      type: 'function',
      function: {
        name: 'book_reservation',
        description: 'Book a hotel reservation',
        parameters: {
          type: 'object',
          properties: {
            guest_name: { type: 'string', description: 'Guest full name' },
            guest_phone: { type: 'string', description: 'Guest phone number' },
            room_type: { type: 'string', description: 'Room type name' },
            check_in_date: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
            check_out_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
          },
          required: ['guest_name', 'guest_phone', 'room_type', 'check_in_date'],
        },
      },
      server: { url: `${baseUrl}/api/vapi/${tenantId}/tool-call` },
    },
    {
      type: 'function',
      function: {
        name: 'get_business_info',
        description: 'Get hotel information like address, phone, room types',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'What to look up' },
          },
          required: ['query'],
        },
      },
      server: { url: `${baseUrl}/api/vapi/${tenantId}/tool-call` },
    },
  ]
}
