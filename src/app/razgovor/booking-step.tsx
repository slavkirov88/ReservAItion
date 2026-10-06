'use client'

import { useEffect, useRef } from 'react'
import { trackSchedule } from '@/lib/meta-pixel'

const CALENDLY = 'https://calendly.com/slavkirovai/30min'

// Calendly only posts events back when the link carries embed_domain and embed_type.
// This step mounts after step 1 is submitted, so window always exists here.
export function BookingStep({
  name,
  email,
  onBooked,
}: {
  name: string
  email: string
  onBooked: () => void
}) {
  const onBookedRef = useRef(onBooked)
  useEffect(() => {
    onBookedRef.current = onBooked
  }, [onBooked])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== 'https://calendly.com') return
      if (e.data?.event === 'calendly.event_scheduled') {
        trackSchedule('razgovor')
        onBookedRef.current()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const prefill = new URLSearchParams({ name, email })
  const embed = new URLSearchParams({
    name,
    email,
    hide_gdpr_banner: '1',
    embed_type: 'Inline',
    embed_domain: window.location.host,
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-violet-300">Стъпка 2 от 2 · избери удобен час</p>
      <iframe
        title="Избор на час за разговор"
        src={`${CALENDLY}?${embed}`}
        className="w-full h-[700px] rounded-lg bg-white"
      />
      <p className="text-center text-xs text-white/40">
        Календарът не се зарежда?{' '}
        <a
          href={`${CALENDLY}?${prefill}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-violet-300"
        >
          Отвори го тук
        </a>
        . Ако не запишеш час сега, ще ти се обадим.
      </p>
    </div>
  )
}
