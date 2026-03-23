import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder', {
  apiVersion: '2026-02-25.clover',
})

export const PLANS = {
  starter: { priceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter', name: 'Стартов', price: 149 },
  pro: { priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro', name: 'Pro', price: 299 },
} as const

export type PlanKey = keyof typeof PLANS
