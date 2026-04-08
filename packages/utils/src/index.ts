import type { TimeOfDayCat } from '@ki/types'

// Derive time_of_day_cat from a timestamp.
// Used in the enrich-capture Edge Function — never from Claude.
export function getTimeOfDayCat(date: Date): TimeOfDayCat {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

// Format a capture timestamp for display in the library feed.
// Returns relative time for recent captures, absolute date for older ones.
export function formatCapturedAt(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Truncate capture body for preview cards in the library.
export function truncateBody(body: string, maxLength = 140): string {
  if (body.length <= maxLength) return body
  return body.slice(0, maxLength).trimEnd() + '…'
}
