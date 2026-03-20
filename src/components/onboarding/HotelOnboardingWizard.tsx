'use client'
import { useState } from 'react'
import { HotelStep1Profile } from './hotel-steps/HotelStep1Profile'
import { HotelStep2Rooms } from './hotel-steps/HotelStep2Rooms'
import { HotelStep3iCal } from './hotel-steps/HotelStep3iCal'
import { HotelStep4Stripe } from './hotel-steps/HotelStep4Stripe'
import { HotelStep5AIConfig } from './hotel-steps/HotelStep5AIConfig'

const STEPS = ['Профил', 'Стаи', 'iCal синхронизация', 'Stripe', 'AI Конфигурация']

export function HotelOnboardingWizard() {
  const [step, setStep] = useState(0)

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`h-px w-8 ${i < step ? 'bg-green-500' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>
      <h2 className="text-lg font-semibold">{STEPS[step]}</h2>

      {step === 0 && <HotelStep1Profile onNext={() => setStep(1)} />}
      {step === 1 && <HotelStep2Rooms onNext={() => setStep(2)} onBack={() => setStep(0)} />}
      {step === 2 && <HotelStep3iCal onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <HotelStep4Stripe onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <HotelStep5AIConfig onBack={() => setStep(3)} />}
    </div>
  )
}
