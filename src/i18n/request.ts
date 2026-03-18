import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'bg'
  const resolvedLocale = ['bg', 'en'].includes(locale) ? locale : 'bg'

  return {
    locale: resolvedLocale,
    messages: (await import(`../../messages/${resolvedLocale}.json`)).default,
  }
})
