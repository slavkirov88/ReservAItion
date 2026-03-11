export interface ServiceItem {
  name: string
  duration_min: number
  price: number
}

export interface FaqItem {
  question: string
  answer: string
}

export interface BusinessProfile {
  business_name: string
  address: string
  services: ServiceItem[]
  faqs: FaqItem[]
  booking_rules: string
  welcome_message_bg: string
}

export function generateSystemPrompt(profile: BusinessProfile, languages: string[]): string {
  const servicesText = profile.services
    .map(s => `- ${s.name}: ${s.duration_min} мин, ${s.price} лв`)
    .join('\n')

  const faqsText = profile.faqs
    .map(f => `В: ${f.question}\nО: ${f.answer}`)
    .join('\n\n')

  const langInstruction = languages.includes('en')
    ? 'Detect the language of the caller and respond in the same language (Bulgarian or English).'
    : 'Говори само на български.'

  return `Ти си AI рецепционист на ${profile.business_name}.
Адрес: ${profile.address}.

УСЛУГИ:
${servicesText || 'Не са посочени услуги.'}

ЧЗВ:
${faqsText || 'Не са посочени ЧЗВ.'}

${profile.booking_rules ? `СПЕЦИАЛНИ ПРАВИЛА:\n${profile.booking_rules}\n` : ''}
ЗАДАЧИ:
1. Отговаряй на въпроси за работното време, адреса и услугите
2. Записвай часове: питай за услуга → предпочитана дата → час → ime и телефон
3. ${langInstruction}
4. При неясна ситуация предложи да се обади пак в работно време

ВАЖНО: Не измисляй информация. Не давай медицински съвети. Бъди учтив и кратък.`
}
