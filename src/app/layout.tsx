import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { ActivePoolProvider } from '@/contexts/ActivePoolContext'
import { ToastProvider } from '@/contexts/ToastContext'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: {
    default: 'Survive the Dance — March Madness Survivor Pool',
    template: '%s | Survive the Dance',
  },
  description: 'Free March Madness survivor pool. Pick one team per round — if they win, you survive. Use each team only once. One wrong pick and you\'re out. Create a pool, invite your friends, and see who can outlast the dance.',
  keywords: ['March Madness', 'survivor pool', 'NCAA tournament', 'bracket pool', 'college basketball', 'survivor game', 'free pool'],
  openGraph: {
    title: 'Survive the Dance — March Madness Survivor Pool',
    description: 'Free survivor pool for the NCAA Tournament. Pick one team per round. Survive or go home. Create a pool and challenge your friends.',
    url: 'https://www.survivethedance.com',
    siteName: 'Survive the Dance',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Survive the Dance',
    description: 'Free March Madness survivor pool. One pick per round. One wrong pick and you\'re out.',
  },
  metadataBase: new URL('https://www.survivethedance.com'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800&family=DM+Sans:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0D1B2A] text-[#E8E6E1] antialiased" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <AuthProvider>
          <ActivePoolProvider>
            <ToastProvider>
              <Header />
              {children}
              <BottomNav />
            </ToastProvider>
          </ActivePoolProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
