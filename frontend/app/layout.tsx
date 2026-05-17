import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, IBM_Plex_Mono, Geist } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { cn } from '@/lib/utils'
import { CgThemeProvider } from '@/components/cg/theme'
import { CgTweaksPanel } from '@/components/cg/tweaks-panel'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
})

const ibmMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-ibm-mono',
})

export const metadata: Metadata = {
  title: 'ClauseGardian — Tending your contracts',
  description: 'We read every page, flag the clauses that could quietly hurt you, and explain them in plain English.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        data-aesthetic="garden"
        data-density="regular"
        className={cn(jakartaSans.variable, ibmMono.variable, geist.variable)}
      >
        <body className="antialiased">
          {/* Design fonts: Instrument Serif (display), Geist (body), Geist Mono
              (numerics). Loaded via <link> so the literal family names also
              resolve inside inline SVG <text> in gauges/donuts. */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
          />
          <CgThemeProvider>
            {children}
            <CgTweaksPanel />
          </CgThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
