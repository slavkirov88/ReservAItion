export default function Terms() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white/80 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-white/30 text-sm mb-10">СЛАМАР ЕООД · ЕИК 208287248 · Last updated: April 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">1. Service</h2>
          <p>ReservAItion is a SaaS platform providing AI-powered reservation management and voice assistant services for hotels. The service is operated by СЛАМАР ЕООД.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">2. Account</h2>
          <p>You are responsible for maintaining the security of your account credentials. One account per business. You must provide accurate information during registration.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">3. Payment</h2>
          <p>Subscriptions are billed monthly via Stripe. Prices are shown in EUR. By subscribing, you authorize recurring charges until cancellation.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">4. Cancellation</h2>
          <p>You may cancel at any time from your account settings. See our <a href="/refund-policy" className="text-violet-400 hover:underline">Refund Policy</a> for details.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">5. Limitation of Liability</h2>
          <p>ReservAItion is provided "as is". СЛАМАР ЕООД is not liable for missed reservations, lost revenue, or damages arising from use of the service.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">6. Contact</h2>
          <p><a href="mailto:support@reservaition.com" className="text-violet-400 hover:underline">support@reservaition.com</a></p>
        </section>
      </div>
    </main>
  )
}
