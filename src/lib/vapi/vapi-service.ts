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
        name: 'get_available_slots',
        description: 'Get available appointment slots for a given date',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            service: { type: 'string', description: 'Service name' },
          },
          required: ['date'],
        },
      },
      server: { url: `${baseUrl}/api/vapi/${tenantId}/tool-call` },
    },
    {
      type: 'function',
      function: {
        name: 'book_appointment',
        description: 'Book an appointment slot',
        parameters: {
          type: 'object',
          properties: {
            patient_name: { type: 'string', description: 'Patient full name' },
            patient_phone: { type: 'string', description: 'Patient phone number' },
            service: { type: 'string', description: 'Service to book' },
            starts_at: { type: 'string', description: 'ISO datetime' },
          },
          required: ['patient_name', 'patient_phone', 'service', 'starts_at'],
        },
      },
      server: { url: `${baseUrl}/api/vapi/${tenantId}/tool-call` },
    },
    {
      type: 'function',
      function: {
        name: 'get_business_info',
        description: 'Get business information like address, hours, services',
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
