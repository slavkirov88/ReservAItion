export const HOTEL_PLANS = {
  starter: {
    priceId: process.env.STRIPE_HOTEL_STARTER_PRICE_ID || 'price_hotel_starter',
    name: 'Стартов',
    nameEn: 'Starter',
    price: 79,
    maxRooms: 10,
  },
  growth: {
    priceId: process.env.STRIPE_HOTEL_GROWTH_PRICE_ID || 'price_hotel_growth',
    name: 'Растеж',
    nameEn: 'Growth',
    price: 149,
    maxRooms: 30,
  },
  pro: {
    priceId: process.env.STRIPE_HOTEL_PRO_PRICE_ID || 'price_hotel_pro',
    name: 'Pro',
    nameEn: 'Pro',
    price: 249,
    maxRooms: Infinity,
  },
} as const

export type HotelPlanKey = keyof typeof HOTEL_PLANS
