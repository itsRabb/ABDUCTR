import type { Metadata } from 'next'
import { Space_Grotesk, Space_Mono, Orbitron } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
})

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ABDUCTR — Alien Lead Abduction System',
  description: 'Abducting B2B Leads from Planet Earth. Premium sci-fi lead generation & CRM.',
  keywords: ['lead generation', 'B2B', 'CRM', 'scraper'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable} ${orbitron.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#0d0d1a',
              border: '1px solid rgba(192,38,211,0.3)',
              color: '#e2e8f0',
              fontFamily: 'var(--font-sans)',
            },
          }}
        />
      </body>
    </html>
  )
}
