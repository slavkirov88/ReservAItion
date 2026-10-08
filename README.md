# ReservAItion

AI-powered receptionist SaaS for Bulgarian hotels and short-term rental properties. Answers the phone in Bulgarian 24/7, records booking requests for the front desk, and publishes an iCal calendar for Booking.com and Airbnb.

**Live:** [reservaition.io](https://reservaition.io)

---

## What it does

Small hotels and short-term rental operators lose bookings when they miss calls outside business hours or when phones go unanswered during cleaning, check-ins, or family time. ReservAItion helps with the missed-call problem with an AI agent that:

- Picks up phone calls 24/7 with a natural Bulgarian-speaking voice
- Answers guest questions about availability, pricing, amenities, and policies
- Records booking requests by phone (the front desk confirms them); the website chat takes reservation requests and can collect a deposit
- Publishes confirmed reservations as an iCal feed that can be added to Booking.com and Airbnb (one-way: reservations made there are not imported)
- Records the request for the front desk when it cannot help
- Also serves the same AI through a chat widget on the property's own website

---

## Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, TailwindCSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Voice AI:** Real-time voice agent integration (telephony layer)
- **Calendar sync:** iCal integration with Booking.com and Airbnb
- **Testing:** Jest
- **Deployment:** Vercel

---

## Key features

- AI phone receptionist (live testable on +359 24 920 219)
- AI chat widget for property websites
- iCal export for Booking.com and Airbnb (one-way)
- Seasonal pricing automation
- Reservation management in the dashboard

---

## Status

Live and in early commercial use with Bulgarian hospitality operators. Active development.

---

## License

Proprietary. Code shown publicly for portfolio review purposes.
