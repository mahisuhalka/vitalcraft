import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VitalCraft ’26 | IEEE EMBS – BMSIT&M',
  description: 'VitalCraft is a 24-hour Hardware & Software hackathon organized by IEEE EMBS – BMSIT&M. Craft ideas. Engineer impact.',
  generator: 'Next.js',
  openGraph: {
    title: 'VitalCraft ’26',
    description: 'Craft ideas. Engineer impact. A 24-hour Hardware & Software hackathon.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCraft ’26',
    description: 'Craft ideas. Engineer impact. A 24-hour Hardware & Software hackathon.',
  }, 
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#101713',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
