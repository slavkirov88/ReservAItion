import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['bg', 'en'],
  defaultLocale: 'bg',
  localeDetection: false,
})
