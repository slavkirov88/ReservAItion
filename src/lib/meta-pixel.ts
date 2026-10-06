// Meta Pixel ID is public by design (it ships in the browser), so a fallback is safe.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1765988711398998'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function trackLead(source: string) {
  window.fbq?.('track', 'Lead', { content_name: source })
  window.fbq?.('track', 'CompleteRegistration', { content_name: source })
}

export function trackSchedule(source: string) {
  window.fbq?.('track', 'Schedule', { content_name: source })
}
