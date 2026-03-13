import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { differenceInDays } from 'date-fns'
import { SubscriptionPlans } from '@/components/subscription/SubscriptionPlans'

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('subscription_status, trial_ends_at')
    .eq('owner_id', user.id)
    .single()

  if (!tenant) redirect('/onboarding')

  const daysLeft = tenant.subscription_status === 'trial'
    ? Math.max(0, differenceInDays(new Date(tenant.trial_ends_at), new Date()))
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Абонамент</h1>
        <p className="text-muted-foreground">Управлявайте вашия план</p>
      </div>
      <SubscriptionPlans
        subscriptionStatus={tenant.subscription_status}
        daysLeft={daysLeft}
      />
    </div>
  )
}
