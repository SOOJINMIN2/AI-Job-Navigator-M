import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'AI Job Navigator',
  description: 'AI-Powered Consulting Platform for your career.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-zinc-950 selection:bg-blue-200 dark:selection:bg-blue-900`}>
        {children}
      </body>
    </html>
  )
}
