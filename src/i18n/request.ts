import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

import { resolveLocale } from './locale'

// next-intl request config (no locale in the URL). The active locale comes from
// the `locale` cookie, falling back to the browser's Accept-Language.
export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const hdrs = await headers()
  const locale = resolveLocale(
    cookieStore.get('locale')?.value,
    hdrs.get('accept-language')
  )
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
