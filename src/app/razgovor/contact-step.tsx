'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { trackLead } from '@/lib/meta-pixel'
import { FALLBACK_PHONE, fieldClass, primaryButtonClass } from './styles'

export type Contact = { leadId: string; name: string; phone: string; email: string }

export function ContactStep({ onDone }: { onDone: (contact: Contact) => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', property: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    const leadId = crypto.randomUUID()
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'contact', leadId, ...form }),
      })
      if (!res.ok) throw new Error('submit_failed')
      trackLead('razgovor')
      onDone({ leadId, name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() })
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-violet-300">Стъпка 1 от 2 · около минута</p>
      <Input
        required
        placeholder="Име"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className={fieldClass}
      />
      <Input
        required
        type="tel"
        placeholder="Телефон"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className={fieldClass}
      />
      <Input
        required
        type="email"
        placeholder="Имейл"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className={fieldClass}
      />
      <Input
        required
        placeholder="Как се казва обектът и колко стаи или имота имате?"
        value={form.property}
        onChange={(e) => setForm({ ...form, property: e.target.value })}
        className={fieldClass}
      />
      <button type="submit" disabled={status === 'loading'} className={primaryButtonClass}>
        {status === 'loading' ? 'Изпращане...' : 'Продължи към избор на час'}
      </button>
      <p className="text-center text-xs text-white/40">
        Ползваме данните ти само за да се свържем за разговора.
      </p>
      {status === 'error' && (
        <p className="text-center text-sm text-red-400/90">
          Нещо не мина. Опитай пак или се обади на {FALLBACK_PHONE}.
        </p>
      )}
    </form>
  )
}
