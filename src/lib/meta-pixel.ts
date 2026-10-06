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
