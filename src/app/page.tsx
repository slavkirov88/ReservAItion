'use client'

import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { DemoChat } from '@/components/landing/DemoChat'
import { AnimatedCounter } from '@/components/landing/AnimatedCounter'

const PHONE = '+35924920219'
const PHONE_DISPLAY = '+359 24 920 219'

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
    nav: { login: 'Вход', cta: 'Заяви разговор' },
    hero: {
      badge: 'AI Рецепционист за хотели и имоти за краткосрочен наем',
      headline: 'Спри да пропускаш обаждания',
      accent: 'докато спиш.',
      sub: 'ReservAItion вдига телефона на български 24/7, отговаря на въпроси за цени и наличност и записва запитването за резервация. Рецепцията получава имейл и потвърждава.',
      cta1: 'Заяви разговор',
      cta2: '📞 Обади се на демото',
      hint: 'Говори директно с AI рецепционист',
      chatLabel: 'Опитай живото демо →',
    },
    stats: [
      { value: 24, prefix: '', suffix: '/7', label: 'вдига телефона' },
      { value: 2, prefix: '', suffix: '', label: 'канала: телефон и чат за сайта' },
      { value: 30, prefix: '', suffix: ' мин', label: 'безплатен разговор за настройка' },
    ],
    pain: {
      title: 'Познато ли ти е?',
      items: [
        { icon: '😴', title: 'Пропуснати резервации нощем', desc: 'Гост се обажда в 23:00 за стая или апартамент, никой не вдига. Резервира при конкуренцията.' },
        { icon: '💸', title: 'Рецепционист = най-скъпият разход', desc: 'Заплата, осигуровки, болнични, отпуски. А все пак не може да е там 24/7.' },
        { icon: '📅', title: 'Календар на няколко места', desc: 'Когато календарът се води на няколко места ръчно, се стига до грешки и ядосани гости.' },
      ],
    },
    forWhom: {
      title: 'За кого е?',
      sub: 'Един продукт, настройван според обекта.',
      items: [
        {
          icon: '🏨',
          title: 'Хотели и хостели',
          desc: 'Телефон и чат на български 24/7, отговори за цени и наличност, сезонни цени. Запитванията стигат до рецепцията, която потвърждава.',
        },
        {
          icon: '🏠',
          title: 'Имоти за краткосрочен наем',
          desc: 'Един номер и чат, които отговарят за гостите на Вашите апартаменти, а календарът се публикува като iCal за Booking.com и Airbnb.',
        },
      ],
    },
    features: {
      title: 'Какво прави за Вас',
      sub: 'Помага на рецепцията да не губи запитвания, когато никой не вдига.',
      items: [
        { icon: '📞', title: 'AI телефон на български', desc: 'Отговаря на обаждания, информира за цени и наличност и записва запитването. Рецепцията получава имейл и потвърждава.' },
        { icon: '🔄', title: 'iCal календар за Booking.com и Airbnb', desc: 'Потвърдените резервации се публикуват като iCal календар, който добавяте в Booking.com и Airbnb. Резервациите от тях не се внасят автоматично в ReservAItion.' },
        { icon: '💬', title: 'AI чат на твоя сайт', desc: 'Чат за сайта, обучен с информацията на Вашия хотел. Отговаря на въпроси и приема заявки за резервация.' },
        { icon: '💰', title: 'Сезонни цени', desc: 'Различни цени за лятото, зимата и всеки специален период, които асистентът казва на гостите.' },
      ],
    },
    how: {
      title: 'Как стартираме',
      steps: [
        { num: '01', title: 'Говорим 30 минути', desc: 'Заявяваш разговор, а ние научаваме как работи твоят обект: стаи, цени, канали.' },
        { num: '02', title: 'Настройваме всичко', desc: 'Ние въвеждаме стаите, цените и правилата, настройваме календара за Booking.com и Airbnb и свързваме телефон за AI асистента.' },
        { num: '03', title: 'Тестваме и пускаме', desc: 'Тествате го заедно с нас. После асистентът поема обажданията, а Вие получавате запитванията.' },
      ],
    },
    pricing: {
      title: 'Прозрачни цени.',
      sub: 'Месечна цена плюс еднократна настройка. Подробностите уточняваме на разговора.',
      popular: 'НАЙ-ПОПУЛЯРЕН',
      perMonth: '/мес',
      plans: [
        { name: 'Стартер', price: '€49', setup: '+ €99 настройка', desc: 'AI чат за сайта', features: ['AI чат на сайта', 'Управление на резервации', 'До 3 типа стаи', 'Имейл известия'], missing: ['AI телефон', 'iCal календар'], cta: 'Заяви разговор', highlight: false },
        { name: 'Про', price: '€99', setup: '+ €149 настройка', desc: 'AI телефон и чат', features: ['Всичко от Стартер', 'AI телефон 24/7', 'iCal календар за Booking/Airbnb', 'Сезонни цени', 'Блокирани дати', 'Телефонен номер'], missing: [], cta: 'Заяви разговор', highlight: true },
        { name: 'Multi-property', price: '€179', setup: '+ €249 настройка', desc: 'Хотели или имоти за краткосрочен наем (3-29 имота)', features: ['Всичко от Про', 'Настройка на няколко обекта', 'Приоритетна поддръжка'], missing: [], cta: 'Заяви разговор', highlight: false },
        { name: 'Enterprise', price: 'Custom', setup: '', desc: '30+ имота', features: ['Всичко от Multi-property', 'Интеграция с PMS (напр. Clock) по договаряне', 'Индивидуална настройка'], missing: [], cta: 'Заяви разговор', highlight: false },
      ],
    },
    faq: {
      title: 'Често задавани въпроси',
      items: [
        { q: 'Говори ли AI-ят наистина Български?', a: 'Да — AI рецепционистът използва Bulgarian TTS и разбира Български естествено.' },
        { q: 'Какво се случва ако AI-ят не знае отговора?', a: 'Казва на госта, че ще се провери, и записва запитването, за да се свърже рецепцията.' },
        { q: 'Трябва ли ми техническо знание?', a: 'Не. Ние настройваме всичко на разговора и след него. Ти само ни казваш как работи обектът.' },
        { q: 'Мога ли да го тествам преди да платя?', a: 'Да — обади се на демо номера и чуй как звучи. На разговора с нас показваме и как ще работи за Вашия обект.' },
        { q: 'Потвърждава ли AI-ят резервацията?', a: 'По телефона записва запитване, а рецепцията го потвърждава. Календарът за Booking.com и Airbnb е еднопосочен: публикуваме Вашите резервации, но не внасяме тези от Booking.com.' },
      ],
    },
    finalCta: {
      title: 'Готов да спреш да пропускаш обаждания?',
      sub: 'Заяви 30-минутен разговор и ние ще настроим AI рецепциониста за твоя обект.',
      cta1: 'Заяви разговор',
      cta2: '📞 Обади се на демото',
    },
    footer: { tagline: 'AI рецепционист за хотели и имоти за краткосрочен наем.' },
  },
  en: {
    nav: { login: 'Login', cta: 'Book a call' },
    hero: {
      badge: 'AI Receptionist for Hotels & Vacation Rentals',
      headline: 'Stop missing calls',
      accent: 'while you sleep.',
      sub: 'ReservAItion answers the phone in Bulgarian 24/7, answers questions about prices and availability and records the booking request. Your front desk gets an email and confirms.',
      cta1: 'Book a call',
      cta2: '📞 Call the demo',
      hint: 'Talk directly to an AI receptionist',
      chatLabel: 'Try the live demo →',
    },
    stats: [
      { value: 24, prefix: '', suffix: '/7', label: 'answers the phone' },
      { value: 2, prefix: '', suffix: '', label: 'channels: phone and website chat' },
      { value: 30, prefix: '', suffix: ' min', label: 'free setup call' },
    ],
    pain: {
      title: 'Sound familiar?',
      items: [
        { icon: '😴', title: 'Missed reservations at night', desc: 'A guest calls at 11pm for a room or apartment, nobody answers. They book the competition.' },
        { icon: '💸', title: 'Receptionist = biggest expense', desc: "Salary, benefits, sick days, holidays. Still can't be there 24/7." },
        { icon: '📅', title: 'Calendar in several places', desc: 'When the calendar is kept by hand in several places, mistakes and angry guests follow.' },
      ],
    },
    forWhom: {
      title: 'Who is it for?',
      sub: 'One product, set up around your property.',
      items: [
        {
          icon: '🏨',
          title: 'Hotels & hostels',
          desc: 'Phone and chat in Bulgarian 24/7, answers on prices and availability, seasonal pricing. Requests go to your front desk, which confirms them.',
        },
        {
          icon: '🏠',
          title: 'Vacation rentals',
          desc: 'One number and chat that answer for the guests of your apartments, with the calendar published as iCal for Booking.com and Airbnb.',
        },
      ],
    },
    features: {
      title: 'What it does for you',
      sub: 'Helps your front desk stop losing enquiries when nobody picks up.',
      items: [
        { icon: '📞', title: 'AI phone in Bulgarian', desc: 'Answers calls, shares prices and availability and records the request. Your front desk gets an email and confirms.' },
        { icon: '🔄', title: 'iCal calendar for Booking.com and Airbnb', desc: 'Confirmed reservations are published as an iCal calendar you add in Booking.com and Airbnb. Reservations made there are not imported into ReservAItion automatically.' },
        { icon: '💬', title: 'AI chat on your website', desc: 'Website chat trained on your hotel info. Answers questions and takes booking requests.' },
        { icon: '💰', title: 'Seasonal pricing', desc: 'Different prices for summer, winter and every special period, which the assistant quotes to guests.' },
      ],
    },
    how: {
      title: 'How we start',
      steps: [
        { num: '01', title: 'We talk for 30 minutes', desc: 'You book a call and we learn how your property works: rooms, prices, channels.' },
        { num: '02', title: 'We set everything up', desc: 'We enter your rooms, prices and rules, set up the calendar for Booking.com and Airbnb, and connect a phone line for the AI assistant.' },
        { num: '03', title: 'Test and launch', desc: 'You test it with us. Then the assistant takes the calls and you receive the requests.' },
      ],
    },
    pricing: {
      title: 'Transparent pricing.',
      sub: 'A monthly price plus a one-time setup fee. We go through the details on the call.',
      popular: 'MOST POPULAR',
      perMonth: '/mo',
      plans: [
        { name: 'Starter', price: '€49', setup: '+ €99 setup', desc: 'AI chat for your website', features: ['AI chat on website', 'Reservation management', 'Up to 3 room types', 'Email notifications'], missing: ['AI phone', 'iCal calendar'], cta: 'Book a call', highlight: false },
        { name: 'Pro', price: '€99', setup: '+ €149 setup', desc: 'AI phone and chat', features: ['Everything in Starter', 'AI phone 24/7', 'iCal calendar for Booking/Airbnb', 'Seasonal pricing', 'Blocked dates', 'Phone number included'], missing: [], cta: 'Book a call', highlight: true },
        { name: 'Multi-property', price: '€179', setup: '+ €249 setup', desc: 'Hotels or vacation rentals (3-29 properties)', features: ['Everything in Pro', 'Setup for several properties', 'Priority support'], missing: [], cta: 'Book a call', highlight: false },
        { name: 'Enterprise', price: 'Custom', setup: '', desc: '30+ properties', features: ['Everything in Multi-property', 'PMS integration (e.g. Clock) by arrangement', 'Custom setup'], missing: [], cta: 'Book a call', highlight: false },
      ],
    },
    faq: {
      title: 'Frequently asked questions',
      items: [
        { q: 'Does the AI really speak Bulgarian?', a: 'Yes — the AI receptionist uses Bulgarian TTS and understands Bulgarian naturally.' },
        { q: "What if the AI doesn't know the answer?", a: 'It tells the guest it will check, and records the request so your front desk can follow up.' },
        { q: 'Do I need technical knowledge?', a: 'No. We set everything up during and after the call. You just tell us how your property works.' },
        { q: 'Can I try before paying?', a: 'Yes — call the demo number and hear how it sounds. On our call we also show how it will work for your property.' },
        { q: 'Does the AI confirm reservations?', a: 'By phone it records a request and your front desk confirms it. The Booking.com and Airbnb calendar is one-way: we publish your reservations but do not import the ones made on Booking.com.' },
      ],
    },
    finalCta: {
      title: 'Ready to stop missing calls?',
      sub: 'Book a 30-minute call and we will set up the AI receptionist for your property.',
      cta1: 'Book a call',
      cta2: '📞 Call the demo',
    },
    footer: { tagline: 'AI receptionist for hotels & vacation rentals.' },
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
              href="/razgovor"
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
            <motion.div initial="hidden" animate="visible" variants={container}>
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
                <Link
                  href="/razgovor"
                  className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-lg shadow-violet-600/25 hover:shadow-violet-500/40 hover:-translate-y-0.5"
                >
                  {t.hero.cta1}
                </Link>
                <a
                  href={`tel:${PHONE}`}
                  className="flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 px-8 py-4 rounded-2xl font-medium text-base text-white/70 hover:text-white transition-all"
                >
                  {t.hero.cta2}
                </a>
              </motion.div>
              <motion.p custom={4} variants={fadeUp} className="text-sm text-white/30 mt-4">
                📱 {PHONE_DISPLAY} · {t.hero.hint}
              </motion.p>
            </motion.div>

            {/* Right — Live Chat */}
            <div>
              <p className="text-sm text-violet-400/70 mb-3 font-medium">{t.hero.chatLabel}</p>
              <DemoChat lang={lang} />
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
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:border-violet-500/30 transition-colors"
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* FOR WHOM */}
      <Section className="py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t.forWhom.title}</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">{t.forWhom.sub}</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {t.forWhom.items.map((item, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 hover:border-violet-500/30 transition-colors"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
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
                className="flex gap-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.pricing.plans.map((plan, i) => {
              const showPerMonth = plan.price.startsWith('€')
              return (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                className={`rounded-2xl p-6 border relative flex flex-col ${
                  plan.highlight
                    ? 'border-violet-500/50 bg-violet-500/10 shadow-xl shadow-violet-500/10'
                    : 'border-white/[0.08] bg-white/[0.03]'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                    ⭐ {t.pricing.popular}
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-sm text-white/40 font-semibold mb-1">{plan.name}</div>
                  <div className="text-4xl font-black mb-1">
                    {plan.price}{showPerMonth && <span className="text-base font-normal text-white/30">{t.pricing.perMonth}</span>}
                  </div>
                  {plan.setup && <div className="text-xs text-white/30">{plan.setup}</div>}
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
                  href="/razgovor"
                  className={`text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'border border-white/10 hover:border-white/20 text-white/70 hover:text-white'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
              )
            })}
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
              <motion.div key={i} custom={i} variants={fadeUp} className="border border-white/[0.08] rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left font-medium hover:bg-white/[0.03] transition-colors"
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
              <Link
                href="/razgovor"
                className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-lg shadow-violet-600/30"
              >
                {t.finalCta.cta1}
              </Link>
              <a
                href={`tel:${PHONE}`}
                className="flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 px-8 py-4 rounded-2xl font-medium text-base text-white/70 hover:text-white transition-all"
              >
                {t.finalCta.cta2}
              </a>
            </motion.div>
            <p className="text-sm text-white/20 mt-6 relative">📱 {PHONE_DISPLAY}</p>
          </div>
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-4 text-sm text-white/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-bold text-white/50">Reserv<span className="text-violet-400">AI</span>tion</span>
              {' '}— {t.footer.tagline}
            </div>
            <div className="flex gap-6">
              <Link href="/login" className="hover:text-white/50 transition-colors">{t.nav.login}</Link>
              <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
              <Link href="/refund-policy" className="hover:text-white/50 transition-colors">Refund Policy</Link>
              <Link href="/terms" className="hover:text-white/50 transition-colors">Terms</Link>
            </div>
          </div>
          <div className="text-center sm:text-left text-white/10 text-xs">
            СЛАМАР ЕООД · ЕИК 208287248 · гр. Черноморец (8142), жк. месност „АКЛАДИ", ет. 2, ап. 222, България · support@reservaition.com
          </div>
        </div>
      </footer>
    </div>
  )
}
