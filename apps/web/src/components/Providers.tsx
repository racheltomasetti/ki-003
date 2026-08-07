'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useEffect, useState } from 'react'
import { applyAccentColor } from '@/lib/accent'
import { ThemeKeyboardShortcut } from './ThemeKeyboardShortcut'

// Reads saved accent from localStorage and applies --color-accent /
// --color-on-accent. Brand terra stays #9e2a2b and is never remapped.
function AccentColorProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem('ki-accent-color')
    if (saved) applyAccentColor(saved)
  }, [])
  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000 },
        },
      })
  )
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeKeyboardShortcut />
      <AccentColorProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AccentColorProvider>
    </ThemeProvider>
  )
}
