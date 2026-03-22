import { generateSystemPrompt } from './prompt-generator'

test('generates Bulgarian prompt with room types', () => {
  const profile = {
    business_name: 'Дентален Център Иванов',
    address: 'ул. Витоша 15, София',
    room_types: [{ name: 'Преглед', capacity: 2, price_per_night: 80 }],
    faqs: [{ question: 'Паркинг?', answer: 'Да, пред сградата.' }],
    booking_rules: '',
    welcome_message_bg: 'Здравейте!'
  }
  const prompt = generateSystemPrompt(profile, ['bg', 'en'])
  expect(prompt).toContain('Дентален Център Иванов')
  expect(prompt).toContain('Преглед')
  expect(prompt).toContain('80 лв')
  expect(prompt).toContain('Паркинг?')
})

test('Bulgarian only when en not in languages', () => {
  const profile = {
    business_name: 'Test', address: 'Sofia',
    room_types: [], faqs: [], booking_rules: '', welcome_message_bg: 'Здравейте!'
  }
  const prompt = generateSystemPrompt(profile, ['bg'])
  expect(prompt).toContain('само на български')
})

test('includes booking rules when provided', () => {
  const profile = {
    business_name: 'Test', address: 'Sofia',
    room_types: [], faqs: [], booking_rules: 'Само с предварителна заявка',
    welcome_message_bg: 'Здравейте!'
  }
  const prompt = generateSystemPrompt(profile, ['bg'])
  expect(prompt).toContain('Само с предварителна заявка')
})
