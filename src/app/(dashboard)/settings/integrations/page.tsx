import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ICalIntegration } from '@/components/settings/ICalIntegration'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('public_api_key, business_name')
    .eq('owner_id', user.id)
    .single()

  if (!tenant) redirect('/onboarding')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const icalExportUrl = `${appUrl}/api/ical/${tenant.public_api_key}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Интеграции</h1>
        <p className="text-muted-foreground">Свържете с Booking.com, Airbnb и други платформи</p>
      </div>
      <ICalIntegration icalExportUrl={icalExportUrl} />
    </div>
  )
}
