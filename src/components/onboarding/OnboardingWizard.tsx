'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Step1BusinessProfile } from './steps/Step1BusinessProfile'
import { Step2Services } from './steps/Step2Services'
import { Step3WorkingHours, type WorkingHour } from './steps/Step3WorkingHours'
import { Step4FAQ } from './steps/Step4FAQ'
import { Step5Complete } from './steps/Step5Complete'

interface Service {
  name: string
  duration_min: number
  price: number
}

interface FAQ {
  question: string
  answer: string
}

interface WizardData {
  businessName: string
  slug: string
  phone: string
  address: string
  services: Service[]
  workingHours: WorkingHour[]
  faqs: FAQ[]
}

const defaultWorkingHours: WorkingHour[] = [0, 1, 2, 3, 4, 5, 6].map(day => ({
  day_of_week: day,
  is_active: day >= 1 && day <= 5,
  start_time: '09:00',
  end_time: '18:00',
  slot_duration_min: 30,
  break_start: '13:00',
  break_end: '14:00',
}))

const STEPS = [
  'Профил на бизнеса',
  'Услуги',
  'Работно време',
  'ЧЗВ',
  'Готово',
]

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ vapiPhone: string; publicApiKey: string } | null>(null)
  const [data, setData] = useState<WizardData>({
    businessName: '',
    slug: '',
    phone: '',
    address: '',
    services: [],
    workingHours: defaultWorkingHours,
    faqs: [],
  })

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Грешка при записване')
      setResult({ vapiPhone: json.vapiPhone || '', publicApiKey: json.publicApiKey })
      setStep(5)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Неочаквана грешка')
    } finally {
      setLoading(false)
    }
  }

  const canNext = step === 1 ? data.businessName.trim().length > 0 : true

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
              i + 1 < step ? 'bg-primary text-primary-foreground' :
              i + 1 === step ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
              'bg-muted text-muted-foreground'
            }`}>
              {i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i + 1 === step ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1]}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <Step1BusinessProfile
              data={{ businessName: data.businessName, slug: data.slug, phone: data.phone, address: data.address }}
              onChange={d => setData(prev => ({ ...prev, ...d }))}
            />
          )}
          {step === 2 && (
            <Step2Services
              services={data.services}
              onChange={services => setData(prev => ({ ...prev, services }))}
            />
          )}
          {step === 3 && (
            <Step3WorkingHours
              workingHours={data.workingHours}
              onChange={workingHours => setData(prev => ({ ...prev, workingHours }))}
            />
          )}
          {step === 4 && (
            <Step4FAQ
              faqs={data.faqs}
              onChange={faqs => setData(prev => ({ ...prev, faqs }))}
            />
          )}
          {step === 5 && result && (
            <Step5Complete vapiPhone={result.vapiPhone} publicApiKey={result.publicApiKey} />
          )}
          {error && <p className="text-destructive text-sm mt-4">{error}</p>}
        </CardContent>
        <CardFooter className="flex justify-between">
          {step > 1 && step < 5 ? (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>
              Назад
            </Button>
          ) : <div />}
          {step < 4 && (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>
              Напред
            </Button>
          )}
          {step === 4 && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Записване...' : 'Завърши настройката'}
            </Button>
          )}
          {step === 5 && (
            <Button onClick={() => router.push('/dashboard')}>
              Към Dashboard
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
