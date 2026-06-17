'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

// Persist the user's language choice and re-render the whole tree (the layout
// reads the cookie to set <html lang dir> + the message bundle).
export async function setLocale(locale: string): Promise<void> {
  const value = locale === 'he' ? 'he' : 'en'
  const cookieStore = await cookies()
  cookieStore.set('locale', value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath('/', 'layout')
}
