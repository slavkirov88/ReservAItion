import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ apiKey: string }> }
) {
  // Suppress unused variable warning
  void request

  const { apiKey } = await params
  const supabase = await createServiceClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, business_name')
    .eq('public_api_key', apiKey)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS })

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('welcome_message_bg')
    .eq('tenant_id', tenant.id)
    .single()

  return NextResponse.json({
    businessName: tenant.business_name,
    welcomeMessage: profile?.welcome_message_bg || 'Здравейте! Как мога да ви помогна?',
    language: 'bg',
  }, {
    headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=300' },
  })
}
