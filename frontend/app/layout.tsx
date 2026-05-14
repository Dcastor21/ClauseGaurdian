import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, IBM_Plex_Mono, Geist } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
  title: 'ClauseGuardian',
  description: 'AI-native contract monitoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn(jakartaSans.variable, ibmMono.variable, "font-sans", geist.variable)}>
        <body className="bg-[#F8FAFC] font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
