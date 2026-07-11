import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CT Committee Treasurer Suite',
  description: 'Campaign finance management and SEEC compliance for Connecticut town and candidate committees',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
