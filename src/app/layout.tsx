import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'

import './globals.css'

const heebo = Heebo({
  subsets: ['latin', 'hebrew'],
  variable: '--font-heebo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AffiliateOS',
  description: 'Affiliate offer underwriting for media buyers.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={heebo.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
