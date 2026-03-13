'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import type { FAQ } from '@/types/database'

interface AIConfig {
  welcome_message_bg: string
  welcome_message_en: string
  booking_rules: string
  faqs: FAQ[]
}

export function AIConfigEditor() {
  const [config, setConfig] = useState<AIConfig>({
    welcome_message_bg: 'Здравейте! Как мога да ви помогна?',
    welcome_message_en: 'Hello! How can I help you?',
    booking_rules: '',
    faqs: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/ai')
      .then(r => r.json())
      .then((d: Partial<AIConfig>) => {
        setConfig(c => ({ ...c, ...d, faqs: d.faqs || [] }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function addFaq() {
    setConfig(c => ({ ...c, faqs: [...c.faqs, { question: '', answer: '' }] }))
  }

  function removeFaq(i: number) {
    setConfig(c => ({ ...c, faqs: c.faqs.filter((_, idx) => idx !== i) }))
  }

  function updateFaq(i: number, field: keyof FAQ, value: string) {
    setConfig(c => ({
      ...c,
      faqs: c.faqs.map((faq, idx) => idx === i ? { ...faq, [field]: value } : faq),
    }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Грешка при запазване')
      setMessage({ type: 'success', text: 'AI конфигурацията е запазена!' })
    } catch {
      setMessage({ type: 'error', text: 'Грешка при запазване' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Зареждане...</div>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Приветствено съобщение</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>На български</Label>
            <Input
              value={config.welcome_message_bg}
              onChange={e => setConfig(c => ({ ...c, welcome_message_bg: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>На английски</Label>
            <Input
              value={config.welcome_message_en}
              onChange={e => setConfig(c => ({ ...c, welcome_message_en: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Специални правила за записване</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Напр. Записвания само за клиенти над 18 години..."
            value={config.booking_rules}
            onChange={e => setConfig(c => ({ ...c, booking_rules: e.target.value }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Често задавани въпроси (ЧЗВ)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.faqs.map((faq, i) => (
            <div key={i} className="space-y-2 border rounded-md p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Въпрос {i + 1}</Label>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFaq(i)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
              <Input
                placeholder="Въпрос"
                value={faq.question}
                onChange={e => updateFaq(i, 'question', e.target.value)}
              />
              <Input
                placeholder="Отговор"
                value={faq.answer}
                onChange={e => updateFaq(i, 'answer', e.target.value)}
              />
            </div>
          ))}
          {config.faqs.length < 10 && (
            <Button variant="outline" size="sm" onClick={addFaq}>
              <Plus className="h-4 w-4 mr-2" />
              Добави въпрос
            </Button>
          )}
        </CardContent>
      </Card>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}
      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Запазване...' : 'Запази промените'}
      </Button>
    </div>
  )
}
