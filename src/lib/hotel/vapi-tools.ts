interface VapiTool {
  type: string
  function: {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, { type: string; description: string }>
      required: string[]
    }
  }
  server: { url: string }
}

export function buildHotelVapiTools(tenantId: string, baseUrl: string): VapiTool[] {
  const serverUrl = `${baseUrl}/api/vapi/${tenantId}/hotel-tool-call`

  return [
    {
      type: 'function',
      function: {
        name: 'check_room_availability',
        description: 'Check available rooms for given dates and number of guests',
        parameters: {
          type: 'object',
          properties: {
            check_in: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
            check_out: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
            guests: { type: 'number', description: 'Number of guests' },
          },
          required: ['check_in', 'check_out', 'guests'],
        },
      },
      server: { url: serverUrl },
    },
    {
      type: 'function',
      function: {
        name: 'create_reservation',
        description: 'Create a reservation and send proforma invoice to guest',
        parameters: {
          type: 'object',
          properties: {
            room_id: { type: 'string', description: 'Room ID from availability check' },
            guest_name: { type: 'string', description: 'Full name of the guest' },
            guest_email: { type: 'string', description: 'Guest email address' },
            guest_phone: { type: 'string', description: 'Guest phone number' },
            check_in: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
            check_out: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
          },
          required: ['room_id', 'guest_name', 'guest_email', 'guest_phone', 'check_in', 'check_out'],
        },
      },
      server: { url: serverUrl },
    },
    {
      type: 'function',
      function: {
        name: 'get_hotel_info',
        description: 'Get hotel information: address, amenities, check-in/out times, FAQs',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'What to look up' },
          },
          required: ['query'],
        },
      },
      server: { url: serverUrl },
    },
    {
      type: 'function',
      function: {
        name: 'cancel_reservation',
        description: 'Cancel a reservation after verifying guest identity',
        parameters: {
          type: 'object',
          properties: {
            reference_number: { type: 'string', description: 'Invoice reference number e.g. INV-2026-0042' },
            phone_last4: { type: 'string', description: 'Last 4 digits of guest phone number' },
          },
          required: ['reference_number', 'phone_last4'],
        },
      },
      server: { url: serverUrl },
    },
  ]
}
