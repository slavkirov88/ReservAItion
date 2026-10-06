'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { CHANNEL_OPTIONS, MISSED_CALLS, PROPERTY_TYPES } from '@/lib/lead-payload'
import type { Contact } from './contact-step'
import { fieldClass, primaryButtonClass } from './styles'

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm transition-colors ${
    active
      ? 'border-violet-400 bg-violet-500/20 text-white'
      : 'border-white/10 text-white/60 hover:border-white/30'
  }`

export function DetailsStep({ contact, onDone }: { contact: Contact; onDone: () => void }) {
  const [propertyType, setPropertyType] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [missedCalls, setMissedCalls] = useState('')
  const [pms, setPms] = useState('')
  const [sending, setSending] = useState(false)

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  // The booking is already made, so a failed send must never block the visitor.
  async function submit() {
    if (sending) return
    setSending(true)
    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'details',
          leadId: contact.leadId,
          name: contact.name,
          phone: contact.phone,
          propertyType,
          channels,
          missedCalls,
          pms,
        }),
      })
    } catch {
      // ignored on purpose
    }
    onDone()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Часът е записан. Последна стъпка, за да дойдем подготвени:</h3>
        <p className="text-sm text-white/50">Четири кратки въпроса, около две минути.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Какъв е обектът?</p>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setPropertyType(t)} className={chip(propertyType === t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Откъде получавате резервации?</p>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((c) => (
            <button key={c} type="button" onClick={() => toggleChannel(c)} className={chip(channels.includes(c))}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Колко обаждания пропускате?</p>
        <div className="flex flex-wrap gap-2">
          {MISSED_CALLS.map((m) => (
            <button key={m} type="button" onClick={() => setMissedCalls(m)} className={chip(missedCalls === m)}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Ползвате ли PMS или друг софтуер за резервации?</p>
        <Input
          placeholder="Напр. Clock PMS, Excel, нищо"
          value={pms}
          onChange={(e) => setPms(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="space-y-2">
        <button type="button" onClick={submit} disabled={sending} className={primaryButtonClass}>
          {sending ? 'Изпращане...' : 'Изпрати'}
        </button>
        <button type="button" onClick={onDone} className="w-full text-center text-sm text-white/40 underline">
          По-късно
        </button>
      </div>
    </div>
  )
}
