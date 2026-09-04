'use client'

// ---------------------------------------------------------------------------
// The Clock PMS+ demo, from a browser.
//
// One button, no second phone number. The assistant behind it is wired to a
// real Clock property: what it quotes comes out of the PMS, and a booking it
// makes shows up in the PMS interface seconds later.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import Vapi from '@vapi-ai/web'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || ''
const ASSISTANT_ID = process.env.NEXT_PUBLIC_CLOCK_DEMO_ASSISTANT_ID || ''

type Status = 'idle' | 'connecting' | 'live' | 'error'

interface Line {
  role: 'assistant' | 'user'
  text: string
}

export default function ClockDemoPage() {
  const vapiRef = useRef<Vapi | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<Line[]>([])

  useEffect(() => {
    if (!PUBLIC_KEY) return
    const vapi = new Vapi(PUBLIC_KEY)
    vapiRef.current = vapi

    vapi.on('call-start', () => setStatus('live'))
    vapi.on('call-end', () => setStatus('idle'))
    vapi.on('error', (e: unknown) => {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Разговорът прекъсна.')
    })
    // Only final transcripts are kept: partial ones rewrite themselves mid-word
    // and the panel turns into noise while someone is presenting.
    vapi.on('message', (msg: { type?: string; transcriptType?: string; role?: string; transcript?: string }) => {
      if (msg?.type !== 'transcript' || msg.transcriptType !== 'final') return
      const role = msg.role === 'assistant' ? 'assistant' : 'user'
      setLines((prev) => [...prev, { role, text: msg.transcript ?? '' }])
    })

    return () => { vapi.stop() }
  }, [])

  const start = async () => {
    setError(null)
    setLines([])
    setStatus('connecting')
    try {
      await vapiRef.current?.start(ASSISTANT_ID)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Не успях да започна разговора.')
    }
  }

  const stop = () => {
    vapiRef.current?.stop()
    setStatus('idle')
  }

  const missingConfig = !PUBLIC_KEY || !ASSISTANT_ID

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="text-sm uppercase tracking-widest text-white/40">ReservAItion</p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-semibold">
          Телефонен рецепционист, свързан с Clock PMS+
        </h1>
        <p className="mt-4 text-white/60 leading-relaxed">
          Питайте за свободни стаи и направете резервация. Наличността и цените идват от
          системата на хотела, а резервацията се записва в нея, не при нас.
        </p>

        {missingConfig ? (
          <p className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            Демото не е конфигурирано: липсва публичен ключ на Vapi или идентификатор на асистента.
          </p>
        ) : (
          <div className="mt-8 flex items-center gap-4">
            {status === 'live' || status === 'connecting' ? (
              <button
                onClick={stop}
                className="rounded-full bg-white px-8 py-4 font-medium text-[#0a0a0f] transition hover:bg-white/90"
              >
                Затвори разговора
              </button>
            ) : (
              <button
                onClick={start}
                className="rounded-full bg-white px-8 py-4 font-medium text-[#0a0a0f] transition hover:bg-white/90"
              >
                Започни разговор
              </button>
            )}

            <span className="text-sm text-white/50">
              {status === 'connecting' && 'Свързвам…'}
              {status === 'live' && 'На линия. Говорете.'}
              {status === 'idle' && 'Нужен е микрофон.'}
              {status === 'error' && (error ?? 'Нещо се обърка.')}
            </span>
          </div>
        )}

        {lines.length > 0 && (
          <div className="mt-10 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            {lines.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed">
                <span className={line.role === 'assistant' ? 'text-white/40' : 'text-white/40'}>
                  {line.role === 'assistant' ? 'Мария: ' : 'Вие: '}
                </span>
                <span className="text-white/85">{line.text}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
