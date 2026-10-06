export const metadata = {
  title: 'Privacy Policy — ReservAItion',
}

export default function Privacy() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white/80 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-white/30 text-sm mb-10">СЛАМАР ЕООД · ЕИК 208287248 · Last updated: October 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">1. Who we are</h2>
          <p>ReservAItion is operated by СЛАМАР ЕООД (&quot;we&quot;). We are the controller of the personal data described below, except for guest data we process on behalf of our customers (see section 4).</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">2. Data we collect from visitors</h2>
          <p className="mb-2">When you request a call with us we collect your name, phone number, email address and the name and size of your property. We use it only to contact you about ReservAItion and to schedule the call.</p>
          <p>When you book a time, the booking is handled by Calendly, which receives your name, email and chosen time. Our website also uses the Meta Pixel to measure visits and form submissions, so Meta receives information about your visit (such as pages viewed and that a form was submitted).</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">3. Customers</h2>
          <p>If you become a customer we also process your account details (email, business profile) and billing data. Payments are handled by Stripe; we do not store card numbers.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">4. Guest data processed for hotels</h2>
          <p>When a guest calls or chats with a hotel&apos;s AI receptionist, we process the conversation, contact details and reservation details on behalf of that hotel, which is the controller of this data. Guests should contact the hotel for requests about their data.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">5. Who we share data with</h2>
          <p>We use trusted providers to run the service: Supabase (database and authentication), Vercel (hosting), Stripe (payments), Vapi and OpenAI (voice and chat AI), Resend (email), Telegram (internal notifications about new enquiries), Calendly (scheduling) and Meta (advertising measurement). We do not sell personal data.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">6. How long we keep it</h2>
          <p>We keep enquiry data for as long as needed to follow up with you, and customer data for as long as the account exists and as required by accounting law. You can ask us to delete your data at any time.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">7. Your rights</h2>
          <p>Under the GDPR you can request access to, correction, deletion or a copy of your data, object to its processing, and complain to the Bulgarian Commission for Personal Data Protection (cpdp.bg).</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">8. Contact</h2>
          <p><a href="mailto:support@reservaition.com" className="text-violet-400 hover:underline">support@reservaition.com</a></p>
        </section>
      </div>
    </main>
  )
}
