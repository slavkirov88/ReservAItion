'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'

interface FAQ {
  question: string
  answer: string
}

interface Props {
  faqs: FAQ[]
  onChange: (faqs: FAQ[]) => void
}

const SUGGESTIONS = [
  'Има ли паркинг?',
  'Приемате ли НЗОК?',
  'Какви са начините на плащане?',
]

export function Step4FAQ({ faqs, onChange }: Props) {
  function addFAQ(question = '') {
    if (faqs.length >= 10) return
    onChange([...faqs, { question, answer: '' }])
  }

  function removeFAQ(index: number) {
    onChange(faqs.filter((_, i) => i !== index))
  }

  function update(index: number, field: keyof FAQ, value: string) {
    onChange(faqs.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Добавете често задавани въпроси. AI ще ги използва при обаждания. (до 10)
      </p>

      {faqs.map((faq, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-start gap-2">
            <Input
              value={faq.question}
              onChange={e => update(i, 'question', e.target.value)}
              placeholder="Въпрос"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeFAQ(i)}
              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={faq.answer}
            onChange={e => update(i, 'answer', e.target.value)}
            placeholder="Отговор"
            rows={2}
          />
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => addFAQ()} className="gap-2">
          <Plus className="h-4 w-4" />
          Добави въпрос
        </Button>
        {SUGGESTIONS.map(s => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            onClick={() => addFAQ(s)}
            className="text-xs text-muted-foreground"
          >
            + {s}
          </Button>
        ))}
      </div>
    </div>
  )
}
