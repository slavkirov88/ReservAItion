# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current landing page with a dark-themed, highly converting SaaS funnel page featuring Framer Motion animations, split-screen hero with live AI chat demo, animated stats, and all conversion sections.

**Architecture:** Single `src/app/page.tsx` file (full rewrite). Dark theme via Tailwind dark class overrides scoped to landing only. Framer Motion for scroll-triggered animations and counter effects. Live AI chat connects to `/api/chat/[apiKey]` using a demo API key stored in `NEXT_PUBLIC_DEMO_API_KEY` env var. Chat language follows the BG/EN toggle already on the page.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, Framer Motion (new), Anthropic Chat API (existing), shadcn/ui (existing)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/page.tsx` | Rewrite | Full landing page — all sections, BG/EN content, Framer Motion animations |
| `src/components/landing/DemoChat.tsx` | Create | Live AI chat widget connected to demo API key, follows lang prop |
| `src/components/landing/AnimatedCounter.tsx` | Create | Animated number counter (e.g. 0 → 800) triggered on scroll into view |
| `.env.local` | Modify | Add `NEXT_PUBLIC_DEMO_API_KEY=<key>` |
| `package.json` | Modify | Add `framer-motion` dependency |

---

## Task 1: Install Framer Motion

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install package**

```bash
npm install framer-motion
```

- [ ] **Step 2: Verify install**

```bash
grep "framer-motion" package.json
```
Expected: `"framer-motion": "^11.x.x"` in dependencies

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add framer-motion for landing page animations"
```

---

## Task 2: Demo API Key Setup

**Context:** The landing page chat widget needs a real API key from a demo tenant in Supabase. This tenant should have hotel info pre-filled so the AI answers hotel questions intelligently.

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Get the demo API key**

Go to Supabase Dashboard → Table Editor → `tenants` table. Find the demo/test tenant row. Copy the value from the `public_api_key` column.

If no demo tenant exists, insert one:
```sql
INSERT INTO tenants (business_name, owner_id, public_api_key, languages)
VALUES (
  'Demo Хотел',
  (SELECT id FROM auth.users LIMIT 1),
  'demo_' || gen_random_uuid()::text,
  ARRAY['bg', 'en']
)
RETURNING public_api_key;
```

Also insert a business profile:
```sql
INSERT INTO business_profiles (tenant_id, welcome_message_bg, booking_rules, faqs)
SELECT id,
  'Здравейте! Аз съм AI рецепционистът на ReservAItion. Как мога да ви помогна?',
  'Настаняване след 14:00. Напускане до 12:00. Домашни любимци не се допускат.',
  '[
    {"question": "Какви стаи имате?", "answer": "Разполагаме с единични, двойни и апартаменти."},
    {"question": "Какви са цените?", "answer": "Цените варират между €49 и €149 на нощ в зависимост от сезона."},
    {"question": "Има ли паркинг?", "answer": "Да, безплатен паркинг за гостите."}
  ]'::jsonb
FROM tenants WHERE business_name = 'Demo Хотел';
```

- [ ] **Step 2: Add to .env.local**

```bash
echo 'NEXT_PUBLIC_DEMO_API_KEY=<paste-key-here>' >> .env.local
```

Also add to Vercel environment variables:
- Dashboard → Project → Settings → Environment Variables
- Key: `NEXT_PUBLIC_DEMO_API_KEY`
- Value: the API key from Supabase
- Environment: Production, Preview, Development

- [ ] **Step 3: Verify chat API responds**

```bash
curl -X POST http://localhost:3000/api/chat/<your-demo-key> \
  -H "Content-Type: application/json" \
  -d '{"message": "Здравейте", "history": []}'
```
Expected: streaming SSE response with `data: {"text":"..."}` lines

---

## Task 3: AnimatedCounter Component

**Files:**
- Create: `src/components/landing/AnimatedCounter.tsx`

This component animates a number from 0 to a target value when it enters the viewport.

- [ ] **Step 1: Create the component**

```tsx
// src/components/landing/AnimatedCounter.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

interface Props {
  target: number
  duration?: number
  prefix?: string
  suffix?: string
}

export function AnimatedCounter({ target, duration = 2000, prefix = '', suffix = '' }: Props) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress >= 1) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [isInView, target, duration])

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/AnimatedCounter.tsx
git commit -m "feat: add AnimatedCounter component for landing stats"
```

---

## Task 4: DemoChat Component

**Files:**
- Create: `src/components/landing/DemoChat.tsx`

This is the live AI chat widget embedded in the hero. It connects to the real chat API, streams responses, and follows the language toggle.

- [ ] **Step 1: Create the component**

```tsx
// src/components/landing/DemoChat.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  lang: 'bg' | 'en'
  apiKey: string
}

const SUGGESTIONS = {
  bg: ['Имате ли свободни стаи?', 'Какви са цените?', 'Как мога да резервирам?'],
  en: ['Do you have available rooms?', 'What are the prices?', 'How can I book?'],
}

const PLACEHOLDER = {
  bg: 'Напишете въпрос...',
  en: 'Ask a question...',
}

const TITLE = {
  bg: '🤖 AI Рецепционист — Демо',
  en: '🤖 AI Receptionist — Demo',
}

export function DemoChat({ lang, apiKey }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      const res = await fetch(`/api/chat/${apiKey}`, {
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
            const { text: t } = JSON.parse(data)
            assistantText += t
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-white/40 text-sm text-center mt-8">
              {lang === 'bg' ? 'Задайте въпрос на AI рецепциониста' : 'Ask the AI receptionist anything'}
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
                {msg.content || (loading && i === messages.length - 1 ? '...' : '')}
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
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/DemoChat.tsx
git commit -m "feat: add DemoChat component for landing page hero"
```

---

## Task 5: New Landing Page

**Files:**
- Rewrite: `src/app/page.tsx`

This is the full dark-themed landing page rewrite with Framer Motion animations, split-screen hero, and all conversion sections.

- [ ] **Step 1: Rewrite src/app/page.tsx**

```tsx
'use client'

import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { DemoChat } from '@/components/landing/DemoChat'
import { AnimatedCounter } from '@/components/landing/AnimatedCounter'

const PHONE = '+35924920219'
const PHONE_DISPLAY = '+359 24 920 219'
// NEXT_PUBLIC_ vars are replaced at build time — ensure this is set in .env.local AND Vercel env vars
// If missing, the chat section shows a placeholder "Demo API key not configured"
const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_API_KEY || ''

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
}

// Container variant to drive staggered children animations on scroll entry
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

function Section({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.section
      id={id}
      ref={ref}
      variants={container}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className={className}
    >
      {children}
    </motion.section>
  )
}

const content = {
  bg: {
    nav: { login: 'Вход', cta: 'Започни безплатно' },
    hero: {
      badge: 'AI Рецепционист за хотели',
      headline: 'Спри да пропускаш резервации',
      accent: 'докато спиш.',
      sub: 'ReservAItion отговаря на телефона, приема резервации и синхронизира с Booking.com — 24/7, на Български, без почивни дни.',
      cta1: '📞 Обади се на демото',
      cta2: 'Научи повече',
      hint: 'Говори директно с AI рецепционист',
      chatLabel: 'Опитай живото демо →',
    },
    stats: [
      { value: 800, prefix: '€', suffix: '+', label: 'спестени на месец' },
      { value: 24, suffix: '/7', label: 'отговаря на обаждания' },
      { value: 0, suffix: '', label: 'пропуснати резервации' },
    ],
    pain: {
      title: 'Познато ли ти е?',
      items: [
        { icon: '😴', title: 'Пропуснати резервации нощем', desc: 'Гост се обажда в 23:00, никой не вдига — резервира в съседния хотел.' },
        { icon: '💸', title: 'Рецепционист = най-скъпият разход', desc: 'Заплата, осигуровки, болнични, отпуски. А все пак не може да е там 24/7.' },
        { icon: '📅', title: 'Двойни резервации', desc: 'Ръчната синхронизация с Booking.com води до грешки и ядосани гости.' },
      ],
    },
    features: {
      title: 'Един инструмент. Всичко включено.',
      sub: 'Замества рецепционист, channel manager и booking система.',
      items: [
        { icon: '📞', title: 'AI телефон на Български', desc: 'Отговаря на обаждания, информира за цени и наличност, приема резервации — на чист Български.' },
        { icon: '🔄', title: 'Sync с Booking.com & Airbnb', desc: 'iCal интеграция в реално време. Без двойни резервации, без ръчна работа.' },
        { icon: '💬', title: 'AI чат на твоя сайт', desc: 'Чат widget, обучен с информацията на твоя хотел. Отговаря и резервира.' },
        { icon: '💰', title: 'Сезонни цени', desc: 'Автоматично различни цени за лятото, зимата и всеки специален период.' },
      ],
    },
    how: {
      title: 'Готов за 24 часа',
      steps: [
        { num: '01', title: 'Регистрирай се', desc: 'Въведи информацията за хотела си за 10 минути.' },
        { num: '02', title: 'Получи номер', desc: 'Даваме ти Bulgarian номер свързан с твоя AI асистент.' },
        { num: '03', title: 'Пусни и забрави', desc: 'AI-ят поема. Ти получаваш резервации.' },
      ],
    },
    pricing: {
      title: 'Прозрачни цени.',
      sub: 'Спри да плащаш €900/месец за рецепционист.',
      plans: [
        { name: 'Стартер', price: '€49', setup: '+ €99 настройка', desc: 'AI чат за сайта', features: ['AI чат на сайта', 'Управление на резервации', 'До 3 типа стаи', 'Имейл известия'], missing: ['AI телефон', 'iCal sync'], cta: 'Започни', highlight: false },
        { name: 'Про', price: '€99', setup: '+ €149 настройка', desc: 'Пълен AI рецепционист', features: ['Всичко от Стартер', 'AI телефон 24/7', 'iCal sync (Booking/Airbnb)', 'Сезонни цени', 'Блокирани дати', 'Телефонен номер'], missing: [], cta: 'Избери Про', highlight: true },
        { name: 'Хотел', price: '€179', setup: '+ €249 настройка', desc: 'До 3 имота', features: ['Всичко от Про', 'До 3 имота', 'Custom AI глас', 'Приоритетна поддръжка'], missing: [], cta: 'Свържи се', highlight: false },
      ],
    },
    faq: {
      title: 'Често задавани въпроси',
      items: [
        { q: 'Говори ли AI-ят наистина Български?', a: 'Да — AI рецепционистът използва Bulgarian TTS и разбира Български естествено.' },
        { q: 'Какво се случва ако AI-ят не знае отговора?', a: 'Уведомява госта и ти изпраща имейл с въпроса.' },
        { q: 'Трябва ли ми техническо знание?', a: 'Не. Ние настройваме всичко. Ти само попълваш информацията за хотела.' },
        { q: 'Мога ли да го тествам преди да платя?', a: 'Да — обади се на демо номера или изпробвай чата вдясно.' },
      ],
    },
    finalCta: {
      title: 'Готов да спреш да пропускаш резервации?',
      sub: 'Обади се на демото и чуй как звучи твоят бъдещ AI рецепционист.',
      cta1: '📞 Обади се сега',
      cta2: 'Или започни безплатно →',
    },
    footer: { tagline: 'AI рецепционист за хотели.' },
  },
  en: {
    nav: { login: 'Login', cta: 'Start for free' },
    hero: {
      badge: 'AI Receptionist for Hotels',
      headline: 'Stop missing reservations',
      accent: 'while you sleep.',
      sub: 'ReservAItion answers calls, takes reservations and syncs with Booking.com — 24/7, in Bulgarian, no days off.',
      cta1: '📞 Call the demo',
      cta2: 'Learn more',
      hint: 'Talk directly to an AI receptionist',
      chatLabel: 'Try the live demo →',
    },
    stats: [
      { value: 800, prefix: '€', suffix: '+', label: 'saved per month' },
      { value: 24, suffix: '/7', label: 'answers calls' },
      { value: 0, suffix: '', label: 'missed reservations' },
    ],
    pain: {
      title: 'Sound familiar?',
      items: [
        { icon: '😴', title: 'Missed reservations at night', desc: 'A guest calls at 11pm, nobody answers — they book the hotel next door.' },
        { icon: '💸', title: 'Receptionist = biggest expense', desc: 'Salary, benefits, sick days, holidays. Still can\'t be there 24/7.' },
        { icon: '📅', title: 'Double bookings', desc: 'Manual Booking.com sync causes errors and angry guests.' },
      ],
    },
    features: {
      title: 'One tool. Everything included.',
      sub: 'Replaces a receptionist, channel manager and booking system.',
      items: [
        { icon: '📞', title: 'AI phone in Bulgarian', desc: 'Answers calls, shares prices and availability, takes reservations — naturally.' },
        { icon: '🔄', title: 'Sync with Booking.com & Airbnb', desc: 'Real-time iCal integration. No double bookings, no manual work.' },
        { icon: '💬', title: 'AI chat on your website', desc: 'Chat widget trained on your hotel info. Answers questions and takes bookings.' },
        { icon: '💰', title: 'Seasonal pricing', desc: 'Automatic different prices for summer, winter and every special period.' },
      ],
    },
    how: {
      title: 'Ready in 24 hours',
      steps: [
        { num: '01', title: 'Sign up', desc: 'Add your hotel info in 10 minutes.' },
        { num: '02', title: 'Get a number', desc: 'We give you a Bulgarian number connected to your AI assistant.' },
        { num: '03', title: 'Launch and forget', desc: 'AI takes over. You receive reservations.' },
      ],
    },
    pricing: {
      title: 'Transparent pricing.',
      sub: 'Stop paying €900/month for a receptionist.',
      plans: [
        { name: 'Starter', price: '€49', setup: '+ €99 setup', desc: 'AI chat for your website', features: ['AI chat on website', 'Reservation management', 'Up to 3 room types', 'Email notifications'], missing: ['AI phone', 'iCal sync'], cta: 'Get started', highlight: false },
        { name: 'Pro', price: '€99', setup: '+ €149 setup', desc: 'Full AI receptionist', features: ['Everything in Starter', 'AI phone 24/7', 'iCal sync (Booking/Airbnb)', 'Seasonal pricing', 'Blocked dates', 'Phone number included'], missing: [], cta: 'Choose Pro', highlight: true },
        { name: 'Hotel', price: '€179', setup: '+ €249 setup', desc: 'Up to 3 properties', features: ['Everything in Pro', 'Up to 3 properties', 'Custom AI voice', 'Priority support'], missing: [], cta: 'Contact us', highlight: false },
      ],
    },
    faq: {
      title: 'Frequently asked questions',
      items: [
        { q: 'Does the AI really speak Bulgarian?', a: 'Yes — the AI receptionist uses Bulgarian TTS and understands Bulgarian naturally.' },
        { q: 'What if the AI doesn\'t know the answer?', a: 'It notifies the guest and sends you an email with the question.' },
        { q: 'Do I need technical knowledge?', a: 'No. We set everything up. You just fill in your hotel information.' },
        { q: 'Can I try before paying?', a: 'Yes — call the demo number or try the chat on the right.' },
      ],
    },
    finalCta: {
      title: 'Ready to stop missing reservations?',
      sub: 'Call the demo and hear what your future AI receptionist sounds like.',
      cta1: '📞 Call now',
      cta2: 'Or start for free →',
    },
    footer: { tagline: 'AI receptionist for hotels.' },
  },
}

export default function LandingPage() {
  const [lang, setLang] = useState<'bg' | 'en'>('bg')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const t = content[lang]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">
            Reserv<span className="text-violet-400">AI</span>tion
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'bg' ? 'en' : 'bg')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
            >
              <span>{lang === 'bg' ? '🇧🇬' : '🇬🇧'}</span>
              <span className="font-medium">{lang === 'bg' ? 'BG' : 'EN'}</span>
            </button>
            <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5">
              {t.nav.login}
            </Link>
            <Link
              href="/register"
              className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-4 py-1.5 rounded-full font-medium transition-all"
            >
              {t.nav.cta}
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp}>
              <motion.div
                custom={0}
                variants={fadeUp}
                className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide uppercase"
              >
                {t.hero.badge}
              </motion.div>
              <motion.h1 custom={1} variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-4">
                {t.hero.headline}<br />
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {t.hero.accent}
                </span>
              </motion.h1>
              <motion.p custom={2} variants={fadeUp} className="text-lg text-white/50 max-w-lg mb-8 leading-relaxed">
                {t.hero.sub}
              </motion.p>
              <motion.div custom={3} variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                <a
                  href={`tel:${PHONE}`}
                  className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-lg shadow-violet-600/25 hover:shadow-violet-500/40 hover:-translate-y-0.5"
                >
                  {t.hero.cta1}
                </a>
                <a
                  href="#how"
                  className="flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 px-8 py-4 rounded-2xl font-medium text-base text-white/70 hover:text-white transition-all"
                >
                  {t.hero.cta2} →
                </a>
              </motion.div>
              <motion.p custom={4} variants={fadeUp} className="text-sm text-white/30 mt-4">
                📱 {PHONE_DISPLAY} · {t.hero.hint}
              </motion.p>
            </motion.div>

            {/* Right — Live Chat */}
            <div>
              <p className="text-sm text-violet-400/70 mb-3 font-medium">{t.hero.chatLabel}</p>
              {DEMO_API_KEY ? (
                <DemoChat lang={lang} apiKey={DEMO_API_KEY} />
              ) : (
                <div className="h-[480px] rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-white/20 text-sm">
                  Demo API key not configured
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <Section className="py-16 px-4 sm:px-6 border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {t.stats.map((stat, i) => (
              <motion.div key={i} custom={i} variants={fadeUp}>
                <div className="text-4xl sm:text-5xl font-black text-white mb-2">
                  <AnimatedCounter
                    target={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                  />
                </div>
                <p className="text-white/40 text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* PAIN */}
      <Section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-center mb-12">
            {t.pain.title}
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {t.pain.items.map((item, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                className="bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-violet-500/30 transition-colors"
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* FEATURES */}
      <Section className="py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t.features.title}</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">{t.features.sub}</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {t.features.items.map((item, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                className="flex gap-4 bg-white/3 border border-white/8 rounded-2xl p-6 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
              >
                <div className="text-2xl shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <h3 className="font-bold text-base mb-1">{item.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section id="how" className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-center mb-16">
            {t.how.title}
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {t.how.steps.map((step, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} className="text-center">
                <div className="text-6xl font-black text-violet-500/20 mb-4">{step.num}</div>
                <h3 className="font-bold text-xl mb-2">{step.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* PRICING */}
      <Section id="pricing" className="py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t.pricing.title}</h2>
            <p className="text-white/40 text-lg">{t.pricing.sub}</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {t.pricing.plans.map((plan, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                className={`rounded-2xl p-6 border relative flex flex-col ${
                  plan.highlight
                    ? 'border-violet-500/50 bg-violet-500/10 shadow-xl shadow-violet-500/10'
                    : 'border-white/8 bg-white/3'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                    ⭐ {lang === 'bg' ? 'НАЙ-ПОПУЛЯРЕН' : 'MOST POPULAR'}
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-sm text-white/40 font-semibold mb-1">{plan.name}</div>
                  <div className="text-4xl font-black mb-1">
                    {plan.price}<span className="text-base font-normal text-white/30">/mo</span>
                  </div>
                  <div className="text-xs text-white/30">{plan.setup}</div>
                </div>
                <p className="text-sm text-white/40 mb-4">{plan.desc}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <span className="text-violet-400 mt-0.5">✓</span>
                      <span className="text-white/80">{f}</span>
                    </li>
                  ))}
                  {plan.missing.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-white/20">
                      <span className="mt-0.5">✗</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'border border-white/10 hover:border-white/20 text-white/70 hover:text-white'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-center mb-12">
            {t.faq.title}
          </motion.h2>
          <div className="space-y-3">
            {t.faq.items.map((item, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} className="border border-white/8 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left font-medium hover:bg-white/3 transition-colors"
                >
                  <span>{item.q}</span>
                  <span className={`transition-transform text-white/30 ${openFaq === i ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-6 pb-4 text-sm text-white/40 leading-relaxed border-t border-white/5 pt-4"
                  >
                    {item.a}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* FINAL CTA */}
      <Section className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl overflow-hidden border border-violet-500/20 bg-gradient-to-br from-violet-900/40 to-fuchsia-900/20 p-12">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-600/10 via-transparent to-transparent" />
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold mb-4 relative">
              {t.finalCta.title}
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-white/50 text-lg mb-10 relative">
              {t.finalCta.sub}
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row gap-4 justify-center relative">
              <a
                href={`tel:${PHONE}`}
                className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-lg shadow-violet-600/30"
              >
                {t.finalCta.cta1}
              </a>
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 px-8 py-4 rounded-2xl font-medium text-base text-white/70 hover:text-white transition-all"
              >
                {t.finalCta.cta2}
              </Link>
            </motion.div>
            <p className="text-sm text-white/20 mt-6 relative">📱 {PHONE_DISPLAY}</p>
          </div>
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/20">
          <div>
            <span className="font-bold text-white/50">Reserv<span className="text-violet-400">AI</span>tion</span>
            {' '}— {t.footer.tagline}
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-white/50 transition-colors">{t.nav.login}</Link>
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Run dev server and verify page loads**

```bash
npm run dev
```
Open http://localhost:3000 — expected: dark landing page with split hero, chat on right

- [ ] **Step 3: Verify language toggle works**

Click BG/EN toggle — all text should switch language. Chat placeholder and suggestions should switch.

- [ ] **Step 4: Verify demo chat works**

Type a question in the chat → should stream response from the AI receptionist

- [ ] **Step 5: Verify animations**

Scroll down — stats should count up, sections should fade in from below

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/components/landing/
git commit -m "feat: dark landing page redesign with Framer Motion and live AI demo chat"
```

---

## Task 6: Deploy and Verify

- [ ] **Step 1: Push to GitHub**

```bash
git push origin master
```

- [ ] **Step 2: Add NEXT_PUBLIC_DEMO_API_KEY to Vercel**

Vercel Dashboard → Project → Settings → Environment Variables → Add:
- Key: `NEXT_PUBLIC_DEMO_API_KEY`
- Value: the demo API key from Supabase
- Environments: Production ✅, Preview ✅, Development ✅

- [ ] **Step 3: Trigger deploy and verify**

Wait for Vercel deploy (~2 min). Open https://reservaition.vercel.app — verify dark landing page loads for unauthenticated users.

- [ ] **Step 4: Test on mobile**

Open on phone or Chrome DevTools mobile view. Verify responsive layout — chat should stack below hero on mobile.

