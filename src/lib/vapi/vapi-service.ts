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
  website_content?: string
}

const VAPI_API = 'https://api.vapi.ai'

function vapiHeaders() {
  return {
    'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

// Create tools via /tool endpoint and return their IDs
async function createOrUpdateVapiTools(tenantId: string, baseUrl: string): Promise<string[]> {
  const serverUrl = `${baseUrl}/api/vapi/${tenantId}/tool-call`

  const toolDefs = [
    {
      type: 'function',
      function: {
        name: 'get_available_room_types',
        description: 'Check which room types are available for specific dates. Always call this when the guest asks about availability or wants to book.',
        parameters: {
          type: 'object',
          properties: {
            check_in_date: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
            check_out_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
          },
          required: ['check_in_date', 'check_out_date'],
        },
      },
      server: { url: serverUrl },
    },
    {
      type: 'function',
      function: {
        name: 'send_booking_inquiry',
        description: 'Send a booking inquiry to the hotel reception by email. Call this when the guest wants to make a reservation and you have collected their name, dates and number of guests. The phone number is captured automatically from caller ID.',
        parameters: {
          type: 'object',
          properties: {
            guest_name: { type: 'string', description: 'Guest full name' },
            guest_phone: { type: 'string', description: 'Guest phone number' },
            check_in_date: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
            check_out_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
            guests_count: { type: 'string', description: 'Number of guests' },
            room_type: { type: 'string', description: 'Preferred room type name (optional)' },
          },
          required: ['guest_name', 'check_in_date'],
        },
      },
      server: { url: serverUrl },
    },
    {
      type: 'function',
      function: {
        name: 'get_current_date',
        description: 'Returns the current date and year in Bulgarian time (Europe/Sofia). Call this whenever you need to know today\'s date or the current year.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      server: { url: serverUrl },
    },
  ]

  const ids: string[] = []
  for (const tool of toolDefs) {
    const res = await fetch(`${VAPI_API}/tool`, {
      method: 'POST',
      headers: vapiHeaders(),
      body: JSON.stringify(tool),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Vapi tool create error: ${err}`)
    }
    const created = await res.json() as { id: string }
    ids.push(created.id)
  }

  return ids
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
    website_content: profile.website_content || undefined,
  }, tenant.languages || ['bg'])

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const toolIds = await createOrUpdateVapiTools(tenant.id, baseUrl)

  const response = await fetch(`${VAPI_API}/assistant`, {
    method: 'POST',
    headers: vapiHeaders(),
    body: JSON.stringify({
      name: `ReservAItion - ${tenant.business_name}`,
      voice: {
        provider: 'azure',
        voiceId: 'bg-BG-KalinaNeural',
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
        toolIds,
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
    website_content: profile.website_content || undefined,
  }, tenant.languages || ['bg'])

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const toolIds = await createOrUpdateVapiTools(tenant.id, baseUrl)

  const response = await fetch(`${VAPI_API}/assistant/${assistantId}`, {
    method: 'PATCH',
    headers: vapiHeaders(),
    body: JSON.stringify({
      voice: {
        provider: 'azure',
        voiceId: 'bg-BG-KalinaNeural',
      },
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        toolIds,
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
  await fetch(`${VAPI_API}/assistant/${assistantId}`, {
    method: 'DELETE',
    headers: vapiHeaders(),
  })
}
