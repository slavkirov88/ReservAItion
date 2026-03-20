import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { HotelOnboardingWizard } from '@/components/onboarding/HotelOnboardingWizard'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let businessType: string | null = null
  if (user) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_type')
      .eq('owner_id', user.id)
      .single()
    businessType = tenant?.business_type ?? null
  }

  const isHotel = businessType === 'hotel'

  return (
    <div className="py-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">
          {isHotel ? 'Добре дошли в ReservAItion' : 'Добре дошли в ReceptAI'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isHotel
            ? 'Нека настроим вашия хотелски AI рецепционист в 5 прости стъпки.'
            : 'Нека настроим вашия AI рецепционист в 4 прости стъпки.'}
        </p>
      </div>
      {isHotel ? <HotelOnboardingWizard /> : <OnboardingWizard />}
    </div>
  )
}
