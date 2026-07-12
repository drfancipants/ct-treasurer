import type { Metadata } from 'next'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cttreasurer.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CT Committee Treasurer Suite — SEEC-compliant treasurer software',
    template: '%s · CT Committee Treasurer Suite',
  },
  description:
    'Campaign finance management and SEEC compliance for Connecticut town committees and candidate campaigns. Track donations and expenses, then generate ready-to-upload SEEC Form 20 and Form 30 filings.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
