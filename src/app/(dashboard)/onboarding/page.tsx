import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export default function OnboardingPage() {
  return (
    <div className="py-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Добре дошли в ReservAItion</h1>
        <p className="text-muted-foreground mt-2">
          Нека настроим вашия AI рецепционист в 4 прости стъпки.
        </p>
      </div>
      <OnboardingWizard />
    </div>
  )
}
