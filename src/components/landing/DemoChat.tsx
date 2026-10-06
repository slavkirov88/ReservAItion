// src/components/landing/DemoChat.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { trackLead } from '@/lib/meta-pixel'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  lang: 'bg' | 'en'
}

const SUGGESTIONS = {
  bg: ['Колко струва?', 'Как работи?', 'Искам безплатно демо'],
  en: ['How much does it cost?', 'How does it work?', 'I want a free demo'],
}

const PLACEHOLDER = {
  bg: 'Напишете въпрос...',
  en: 'Ask a question...',
}

const TITLE = {
  bg: 'Попитай за ReservAItion',
  en: 'Ask about ReservAItion',
}

const EMPTY_LABEL = {
  bg: 'Питай за цени, как работи и как започваме',
  en: 'Ask about pricing, how it works and how we start',
}

// The model is told to answer in plain text; this strips markdown if it slips anyway.
function plain(text: string) {
  return text.replace(/\*\*/g, '').replace(/^\s*[-*]\s+/gm, '')
}

export function DemoChat({ lang }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length === 0) return
    const container = scrollContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    let assistantText = ''

    try {
      const res = await fetch('/api/landing-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      let streamDone = false
      while (reader && !streamDone) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.replace('data: ', '')
          if (data === '[DONE]') { streamDone = true; break }
          try {
            const parsed = JSON.parse(data)
            if (parsed.lead) { trackLead('chat'); continue }
            assistantText += parsed.text ?? ''
            setMessages(prev => {
              const copy = [...prev]
              copy[copy.length - 1] = { role: 'assistant', content: assistantText }
              return copy
            })
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: lang === 'bg' ? 'Грешка. Опитайте отново.' : 'Error. Please try again.' }])
    }

    setLoading(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="flex flex-col h-[480px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-sm font-medium text-white/80">{TITLE[lang]}</span>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-white/40 text-sm text-center mt-8">
              {EMPTY_LABEL[lang]}
            </p>
            <div className="flex flex-col gap-2 mt-4">
              {SUGGESTIONS[lang].map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-left text-sm px-3 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/10 text-white/90'
                }`}
              >
                {plain(msg.content) || (loading && i === messages.length - 1 ? '...' : '')}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <form
          onSubmit={e => { e.preventDefault(); send(input) }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={PLACEHOLDER[lang]}
            className="flex-1 bg-white/10 text-white placeholder:text-white/30 px-3 py-2 rounded-xl text-sm outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-40 transition-all"
          >
            →
          </button>
        </form>
        <Link href="/razgovor" className="block text-center text-xs text-violet-300/80 hover:text-violet-200 mt-2">
          {lang === 'bg' ? 'Предпочиташ да си избереш час? Заяви разговор →' : 'Prefer to pick a time? Book a call →'}
        </Link>
      </div>
    </motion.div>
  )
}
