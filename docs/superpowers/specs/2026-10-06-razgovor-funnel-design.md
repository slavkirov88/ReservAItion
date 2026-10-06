# Landing: заявка за разговор вместо самостоятелна регистрация

Approved 2026-10-06 (approach A: copy of the /odit funnel from slavkirov.com).

- Every landing CTA (nav, hero, plans, final CTA) leads to `/razgovor`. Links to `/register` are removed from the landing; `/register`, `/login`, dashboard and Stripe are untouched.
- Hero keeps the phone demo as the secondary button. "How" section is rewritten: talk -> we set it up -> test and launch.
- `/razgovor` funnel: contact (saved at once, Telegram) -> Calendly (same link as /odit) (details step removed 2026-10-06: keep it minimal, owner calls the lead).
- `/api/lead` sends Telegram only (no n8n); fails with 502 only if Telegram did not accept it.
- Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (same as slavkirov.com).
- Meta Pixel events are fired via `window.fbq` if a pixel is present; none is installed here.
