import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'Survive the Dance',
  description: 'Every pick could be your last. March Madness Survivor Pool.',
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
          {children}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  )
}
