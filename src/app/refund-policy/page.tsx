export default function RefundPolicy() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white/80 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Refund & Cancellation Policy</h1>
        <p className="text-white/30 text-sm mb-10">СЛАМАР ЕООД · ReservAItion</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">Subscriptions</h2>
          <p>All subscription plans are billed monthly. You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period — you retain access until then.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">Refunds</h2>
          <p>We offer a full refund within 7 days of the first charge if you are not satisfied with the service. After 7 days, subscription fees are non-refundable. To request a refund, contact us at <a href="mailto:support@reservaition.com" className="text-violet-400 hover:underline">support@reservaition.com</a>.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">Free Trial</h2>
          <p>New accounts receive a free trial period. No charge is made during the trial. At the end of the trial, you must select a paid plan to continue using the service.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
          <p>For questions about billing or refunds: <a href="mailto:support@reservaition.com" className="text-violet-400 hover:underline">support@reservaition.com</a></p>
        </section>
      </div>
    </main>
  )
}
