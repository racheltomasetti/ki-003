'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

// Global d/l shortcut to flip light/dark, disabled while typing so it doesn't
// fight with text entry. Mounted once inside ThemeProvider in Providers.tsx.
export function ThemeKeyboardShortcut() {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key !== 'd' && key !== 'l') return
      if (isTypingTarget(event.target)) return

      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [resolvedTheme, setTheme])

  return null
}
