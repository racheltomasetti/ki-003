'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useEffect, useState } from 'react'

// Reads saved accent color from localStorage on mount and applies it to
// --color-terra so all terra-based Tailwind utilities update app-wide.
function AccentColorProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem('ki-accent-color')
    if (saved) {
      document.documentElement.style.setProperty('--color-terra', saved)
    }
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
      <AccentColorProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AccentColorProvider>
    </ThemeProvider>
  )
}
