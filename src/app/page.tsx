'use client'

import { useState } from 'react'
import Link from 'next/link'

const PHONE = '+35924920219'
const PHONE_DISPLAY = '+359 24 920 219'

const content = {
  bg: {
    nav: {
      login: 'Вход',
      cta: 'Започни безплатно',
    },
    hero: {
      badge: '🤖 AI Рецепционист за хотели',
      headline: 'Спри да плащаш €900/месец за рецепционист.',
      headlineAccent: 'AI-ят прави същото за €99.',
      sub: 'ReservAItion отговаря на телефона, приема резервации и синхронизира с Booking.com — 24/7, на Български, без почивни дни.',
      cta1: '📞 Обади се на демото сега',
      cta2: 'Виж как работи',
      callHint: 'Говори директно с нашия AI рецепционист',
    },
    pain: {
      title: 'Познато ли ти е?',
      items: [
        { icon: '😴', title: 'Пропуснати резервации нощем', desc: 'Гост се обажда в 23:00, никой не вдига — той резервира в съседния хотел.' },
        { icon: '💸', title: 'Рецепционист = най-скъпият разход', desc: 'Заплата, осигуровки, болнични, отпуски. А все пак не може да е там 24/7.' },
        { icon: '📅', title: 'Двойни резервации от Booking.com', desc: 'Ръчната синхронизация води до грешки. Един гост с потвърдена резервация — и без стая.' },
      ],
    },
    features: {
      title: 'Всичко, от което се нуждаеш',
      sub: 'Един инструмент замества рецепционист, channel manager и booking система.',
      items: [
        { icon: '📞', title: 'AI телефон на Български', desc: 'Отговаря на обаждания, информира за цени и наличност, приема резервации — на чист Български.' },
        { icon: '🔄', title: 'Синхронизация с Booking.com & Airbnb', desc: 'iCal интеграция в реално време. Без двойни резервации, без ръчна работа.' },
        { icon: '💬', title: 'AI чат на твоя сайт', desc: 'Чат widget, който отговаря на въпроси и приема резервации директно от сайта ти.' },
        { icon: '💰', title: 'Сезонни цени', desc: 'Задай различни цени за лятото, зимните празници и всеки друг период — автоматично.' },
      ],
    },
    how: {
      title: 'Готов за 24 часа',
      steps: [
        { num: '01', title: 'Регистрирай се', desc: 'Създай акаунт и въведи информацията за хотела си за 10 минути.' },
        { num: '02', title: 'Получи телефонен номер', desc: 'Даваме ти Bulgarian номер, свързан с твоя AI асистент. Без допълнителна техника.' },
        { num: '03', title: 'Пусни и забрави', desc: 'AI-ят поема от тук. Ти получаваш резервации, той отговаря на телефона.' },
      ],
    },
    pricing: {
      title: 'Прозрачни цени. Без изненади.',
      sub: 'Спри да плащаш €900/месец за рецепционист. Виж колко спестяваш.',
      plans: [
        {
          name: 'Стартер',
          price: '€49',
          setup: '+ €99 настройка',
          desc: 'За хотели, които искат да тестват AI чат',
          features: ['AI чат на сайта', 'Управление на резервации', 'До 3 типа стаи', 'Имейл известия'],
          missing: ['AI телефон', 'iCal синхронизация'],
          cta: 'Започни',
          highlight: false,
        },
        {
          name: 'Про',
          price: '€99',
          setup: '+ €149 настройка',
          desc: 'Пълен AI рецепционист — препоръчваме',
          features: ['Всичко от Стартер', 'AI телефон 24/7 на Български', 'iCal sync (Booking/Airbnb)', 'Сезонни цени', 'Блокирани дати', 'Телефонен номер включен'],
          missing: [],
          cta: 'Избери Про',
          highlight: true,
        },
        {
          name: 'Хотел',
          price: '€179',
          setup: '+ €249 настройка',
          desc: 'За хотели с повече имоти',
          features: ['Всичко от Про', 'До 3 имота', 'Custom AI глас/скрипт', 'Директен booking widget', 'Приоритетна поддръжка', 'Месечни отчети'],
          missing: [],
          cta: 'Свържи се с нас',
          highlight: false,
        },
      ],
      compare: 'Сравни с рецепционист: €900/месец заплата + осигуровки. ReservAItion Про = €99/месец. Спестяваш €800+ на месец.',
    },
    faq: {
      title: 'Често задавани въпроси',
      items: [
        { q: 'Говори ли AI-ят наистина Български?', a: 'Да — AI рецепционистът използва Bulgarian TTS и разбира Български. Работи естествено с местни гости.' },
        { q: 'Какво се случва ако AI-ят не знае отговора?', a: 'Уведомява госта, че ще бъде свързан с хотела, и ти изпраща имейл с въпроса.' },
        { q: 'Трябва ли ми техническо знание?', a: 'Не. Ние настройваме всичко. Ти само попълваш информацията за хотела си.' },
        { q: 'Мога ли да го тествам преди да платя?', a: 'Да — обади се на нашия демо номер и говори директно с AI рецепционист.' },
      ],
    },
    finalCta: {
      title: 'Готов да спреш да пропускаш резервации?',
      sub: 'Обади се на демото и чуй как звучи твоят бъдещ AI рецепционист.',
      cta1: '📞 Обади се на демото',
      cta2: 'Или започни безплатно →',
    },
    footer: {
      tagline: 'AI рецепционист за хотели.',
      links: ['Вход', 'Политика за поверителност'],
    },
  },
  en: {
    nav: {
      login: 'Login',
      cta: 'Start for free',
    },
    hero: {
      badge: '🤖 AI Receptionist for Hotels',
      headline: 'Stop paying €900/month for a receptionist.',
      headlineAccent: 'AI does the same for €99.',
      sub: 'ReservAItion answers calls, takes reservations and syncs with Booking.com — 24/7, in Bulgarian, no days off.',
      cta1: '📞 Call the demo now',
      cta2: 'See how it works',
      callHint: 'Talk directly to our AI receptionist',
    },
    pain: {
      title: 'Sound familiar?',
      items: [
        { icon: '😴', title: 'Missed reservations at night', desc: 'A guest calls at 11pm, nobody answers — they book the hotel next door.' },
        { icon: '💸', title: 'Receptionist = your biggest expense', desc: 'Salary, benefits, sick days, holidays. And still can\'t be there 24/7.' },
        { icon: '📅', title: 'Double bookings from Booking.com', desc: 'Manual sync causes errors. One guest with a confirmed reservation — and no room.' },
      ],
    },
    features: {
      title: 'Everything you need',
      sub: 'One tool replaces a receptionist, channel manager and booking system.',
      items: [
        { icon: '📞', title: 'AI phone in Bulgarian', desc: 'Answers calls, shares prices and availability, takes reservations — in natural Bulgarian.' },
        { icon: '🔄', title: 'Sync with Booking.com & Airbnb', desc: 'Real-time iCal integration. No double bookings, no manual work.' },
        { icon: '💬', title: 'AI chat on your website', desc: 'A chat widget that answers questions and takes reservations directly from your site.' },
        { icon: '💰', title: 'Seasonal pricing', desc: 'Set different prices for summer, winter holidays, and any period — automatically.' },
      ],
    },
    how: {
      title: 'Ready in 24 hours',
      steps: [
        { num: '01', title: 'Sign up', desc: 'Create an account and add your hotel info in 10 minutes.' },
        { num: '02', title: 'Get a phone number', desc: 'We give you a Bulgarian number connected to your AI assistant. No extra hardware.' },
        { num: '03', title: 'Launch and forget', desc: 'AI takes it from here. You get reservations, it answers the phone.' },
      ],
    },
    pricing: {
      title: 'Transparent pricing. No surprises.',
      sub: 'Stop paying €900/month for a receptionist. See how much you save.',
      plans: [
        {
          name: 'Starter',
          price: '€49',
          setup: '+ €99 setup',
          desc: 'For hotels that want to test AI chat',
          features: ['AI chat on website', 'Reservation management', 'Up to 3 room types', 'Email notifications'],
          missing: ['AI phone', 'iCal sync'],
          cta: 'Get started',
          highlight: false,
        },
        {
          name: 'Pro',
          price: '€99',
          setup: '+ €149 setup',
          desc: 'Full AI receptionist — recommended',
          features: ['Everything in Starter', 'AI phone 24/7 in Bulgarian', 'iCal sync (Booking/Airbnb)', 'Seasonal pricing', 'Blocked dates', 'Phone number included'],
          missing: [],
          cta: 'Choose Pro',
          highlight: true,
        },
        {
          name: 'Hotel',
          price: '€179',
          setup: '+ €249 setup',
          desc: 'For hotels with multiple properties',
          features: ['Everything in Pro', 'Up to 3 properties', 'Custom AI voice/script', 'Direct booking widget', 'Priority support', 'Monthly reports'],
          missing: [],
          cta: 'Contact us',
          highlight: false,
        },
      ],
      compare: 'Compare with a receptionist: €900/month salary + benefits. ReservAItion Pro = €99/month. Save €800+ per month.',
    },
    faq: {
      title: 'Frequently asked questions',
      items: [
        { q: 'Does the AI really speak Bulgarian?', a: 'Yes — the AI receptionist uses Bulgarian TTS and understands Bulgarian. Works naturally with local guests.' },
        { q: 'What if the AI doesn\'t know the answer?', a: 'It lets the guest know they\'ll be connected with the hotel, and sends you an email with the question.' },
        { q: 'Do I need technical knowledge?', a: 'No. We set everything up. You just fill in your hotel information.' },
        { q: 'Can I try it before paying?', a: 'Yes — call our demo number and talk directly to an AI receptionist.' },
      ],
    },
    finalCta: {
      title: 'Ready to stop missing reservations?',
      sub: 'Call the demo and hear what your future AI receptionist sounds like.',
      cta1: '📞 Call the demo',
      cta2: 'Or start for free →',
    },
    footer: {
      tagline: 'AI receptionist for hotels.',
      links: ['Login', 'Privacy Policy'],
    },
  },
}

export default function LandingPage() {
  const [lang, setLang] = useState<'bg' | 'en'>('bg')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const t = content[lang]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">
            Reserv<span className="text-primary">AI</span>tion
          </span>
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'bg' ? 'en' : 'bg')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <span className="text-base">{lang === 'bg' ? '🇧🇬' : '🇬🇧'}</span>
              <span className="font-medium">{lang === 'bg' ? 'BG' : 'EN'}</span>
              <span className="text-xs opacity-50">→ {lang === 'bg' ? 'EN' : 'BG'}</span>
            </button>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              {t.nav.login}
            </Link>
            <Link
              href="/register"
              className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              {t.nav.cta}
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-4 sm:px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            {t.hero.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-4">
            {t.hero.headline}<br />
            <span className="text-primary">{t.hero.headlineAccent}</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t.hero.sub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href={`tel:${PHONE}`}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              {t.hero.cta1}
            </a>
            <a
              href="#how"
              className="flex items-center gap-2 border border-border px-8 py-4 rounded-2xl font-medium text-lg hover:border-foreground/30 transition-colors"
            >
              {t.hero.cta2} →
            </a>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            📱 {PHONE_DISPLAY} · {t.hero.callHint}
          </p>
        </div>
      </section>

      {/* PAIN */}
      <section className="py-20 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">{t.pain.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {t.pain.items.map((item, i) => (
              <div key={i} className="bg-background border border-border rounded-2xl p-6">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.features.title}</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">{t.features.sub}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {t.features.items.map((item, i) => (
              <div key={i} className="flex gap-4 bg-muted/20 border border-border rounded-2xl p-6 hover:border-primary/30 transition-colors">
                <div className="text-3xl shrink-0">{item.icon}</div>
                <div>
                  <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">{t.how.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {t.how.steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="text-5xl font-black text-primary/20 mb-4">{step.num}</div>
                <h3 className="font-bold text-xl mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.pricing.title}</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">{t.pricing.sub}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            {t.pricing.plans.map((plan, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 border relative flex flex-col ${
                  plan.highlight
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-border bg-muted/10'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                    ⭐ {lang === 'bg' ? 'НАЙ-ПОПУЛЯРЕН' : 'MOST POPULAR'}
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-sm text-muted-foreground font-semibold mb-1">{plan.name}</div>
                  <div className="text-4xl font-black mb-1">{plan.price}<span className="text-base font-normal text-muted-foreground">/mo</span></div>
                  <div className="text-xs text-muted-foreground">{plan.setup}</div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{plan.desc}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <span className="text-primary mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.missing.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground/50">
                      <span className="mt-0.5">✗</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-primary text-primary-foreground hover:opacity-90'
                      : 'border border-border hover:border-foreground/30'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-muted-foreground bg-muted/20 border border-border rounded-xl p-4">
            💡 {t.pricing.compare}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">{t.faq.title}</h2>
          <div className="space-y-3">
            {t.faq.items.map((item, i) => (
              <div key={i} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left font-medium hover:bg-muted/30 transition-colors"
                >
                  <span>{item.q}</span>
                  <span className={`transition-transform text-muted-foreground ${openFaq === i ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-4 sm:px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">{t.finalCta.title}</h2>
          <p className="text-muted-foreground text-lg mb-10">{t.finalCta.sub}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`tel:${PHONE}`}
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              {t.finalCta.cta1}
            </a>
            <Link
              href="/register"
              className="flex items-center justify-center gap-2 border border-border px-8 py-4 rounded-2xl font-medium text-lg hover:border-foreground/30 transition-colors"
            >
              {t.finalCta.cta2}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-6">📱 {PHONE_DISPLAY}</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-bold text-foreground">Reserv<span className="text-primary">AI</span>tion</span>
            {' '}— {t.footer.tagline}
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">{t.footer.links[0]}</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">{t.footer.links[1]}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
