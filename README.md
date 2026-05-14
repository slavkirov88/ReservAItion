# ReservAItion

AI-powered receptionist SaaS for Bulgarian hotels and short-term rental properties. Answers the phone, handles reservations, and syncs with Booking.com - 24/7, in Bulgarian, with no days off.

**Live:** [reservaition.io](https://reservaition.io)

---

## What it does

Small hotels and short-term rental operators lose bookings when they miss calls outside business hours or when phones go unanswered during cleaning, check-ins, or family time. ReservAItion replaces the missed-call problem with an AI agent that:

- Picks up phone calls 24/7 with a natural Bulgarian-speaking voice
- Answers guest questions about availability, pricing, amenities, and policies
- Takes reservations end-to-end (collects guest details, confirms dates, accepts deposits)
- Syncs reservation data with Booking.com via iCal so the calendar never double-books
- Hands off to a human operator when the conversation exits its scope
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
- Multi-property dashboard for operators managing several listings
- Booking.com and Airbnb iCal synchronization (two-way calendar safety)
- Seasonal pricing automation
- Multilingual support on higher tiers
- Reservation management without human intervention for standard inquiries
- Configurable handoff rules for edge cases

---

## Status

Live and in early commercial use with Bulgarian hospitality operators. Active development.

---

## License

Proprietary. Code shown publicly for portfolio review purposes.
