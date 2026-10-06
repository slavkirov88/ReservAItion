'use client'

import { useState } from 'react'
import { BookingStep } from './booking-step'
import { ContactStep, type Contact } from './contact-step'

type Step = 'contact' | 'booking' | 'done'

export function LeadFunnel() {
  const [step, setStep] = useState<Step>('contact')
  const [contact, setContact] = useState<Contact | null>(null)

  if (step === 'contact' || !contact) {
    return (
      <ContactStep
        onDone={(c) => {
          setContact(c)
          setStep('booking')
        }}
      />
    )
  }
  if (step === 'booking') {
    return <BookingStep name={contact.name} email={contact.email} onBooked={() => setStep('done')} />
  }
  return (
    <div className="text-center space-y-2 py-8">
      <p className="text-2xl font-semibold">Благодаря, до скоро.</p>
      <p className="text-sm text-white/50">Потвърждението за часа е в имейла ти.</p>
    </div>
  )
}
