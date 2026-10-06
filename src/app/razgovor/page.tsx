import type { Metadata } from 'next'
import Link from 'next/link'
import { LeadFunnel } from './lead-funnel'

export const metadata: Metadata = {
  title: 'Заяви разговор — ReservAItion',
  description:
    '30 минути разговор за твоя хотел или имот. Показваме ти как AI рецепционистът ще работи при теб и го настройваме вместо теб.',
}

const steps = [
  'Попълваш формата. Около минута',
  'Избираш удобен час',
  'Говорим 30 минути за твоя обект',
  'Настройваме всичко вместо теб: стаи, цени, синхронизация и телефонен номер',
]

const faq = [
  {
    q: 'Защо няма самостоятелна регистрация?',
    a: 'Всеки обект е различен: стаи, цени, канали, правила за отказ. AI рецепционистът работи добре само когато е настроен точно по твоя случай, затова го настройваме заедно.',
  },
  {
    q: 'Струва ли нещо разговорът?',
    a: 'Не. Разговорът е безплатен и без ангажимент. Ако решим да работим заедно, казваме цената предварително.',
  },
  {
    q: 'Колко време отнема да стартираме?',
    a: 'Обикновено до 24 часа след като имаме информацията за обекта.',
  },
]

export default function RazgovorPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-14">
        <div className="space-y-5 text-center">
          <Link href="/" className="inline-block font-bold text-lg tracking-tight">
            Reserv<span className="text-violet-400">AI</span>tion
          </Link>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Да настроим AI рецепциониста за твоя обект
          </h1>
          <p className="text-lg text-white/50">
            30 минути разговор. Виждаме как работите, показваме ти как ще звучи AI рецепционистът при теб и
            го пускаме за теб.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Как протича</h2>
          <ol className="space-y-3 text-white/80">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="text-violet-400 font-semibold">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div id="forma" className="border border-violet-500/20 bg-white/[0.02] rounded-2xl p-6 scroll-mt-8">
          <LeadFunnel />
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Въпроси</h2>
          {faq.map((f) => (
            <div key={f.q} className="space-y-1">
              <h3 className="font-medium">{f.q}</h3>
              <p className="text-white/50">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
