export const SUPPORTED_LOCALES = ['en', 'he'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

function isLocale(value: string | undefined): value is Locale {
  return value === 'en' || value === 'he'
}

// Resolve the active locale: an explicit cookie wins; otherwise prefer Hebrew
// when the browser's Accept-Language asks for it; else fall back to English.
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null
): Locale {
  if (isLocale(cookieValue)) return cookieValue
  if (acceptLanguage && /(?:^|[,\s])he\b/i.test(acceptLanguage)) return 'he'
  return DEFAULT_LOCALE
}
