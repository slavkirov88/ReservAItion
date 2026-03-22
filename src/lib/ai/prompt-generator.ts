export interface FaqItem {
  question: string
  answer: string
}

export interface RoomTypeItem {
  name: string
  capacity: number
  price_per_night: number
  description?: string | null
}

export interface HotelProfile {
  business_name: string
  address: string
  room_types: RoomTypeItem[]
  faqs: FaqItem[]
  booking_rules: string
  welcome_message_bg: string
}

export function generateSystemPrompt(profile: HotelProfile, languages: string[]): string {
  const roomTypesText = profile.room_types
    .map(r => `- ${r.name}: до ${r.capacity} гости, ${r.price_per_night} лв/нощ${r.description ? ` (${r.description})` : ''}`)
    .join('\n')

  const faqsText = profile.faqs
    .map(f => `В: ${f.question}\nО: ${f.answer}`)
    .join('\n\n')

  const langInstruction = languages.includes('en')
    ? 'Detect the language of the caller and respond in the same language (Bulgarian or English).'
    : 'Говори само на български.'

  return `Ти си AI рецепционист на хотел ${profile.business_name}.
Адрес: ${profile.address}.

ТИПОВЕ СТАИ:
${roomTypesText || 'Не са посочени типове стаи.'}

ЧЗВ:
${faqsText || 'Не са посочени ЧЗВ.'}

${profile.booking_rules ? `СПЕЦИАЛНИ ПРАВИЛА:\n${profile.booking_rules}\n` : ''}ЗАДАЧИ:
1. Отговаряй на въпроси за хотела, стаите, цените и удобствата
2. Записвай резервации: питай за тип стая → дата на настаняване → дата на напускане → брой гости → ime и телефон
3. ${langInstruction}
4. При неясна ситуация предложи да се обади отново

ВАЖНО: Не измисляй информация. Бъди учтив и кратък.`
}
