import { View, Text, StyleSheet } from 'react-native'
import { useAppTheme } from '@/hooks/useAppTheme'

type CardCapture = {
  id: string
  captured_at: string
  body: string | null
  type: string
  capture_tags?: Array<{ tag_id: string; tags?: { id: string; name: string } | null }>
}

interface RecentCaptureCardProps {
  capture: CardCapture
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (date.toDateString() === now.toDateString()) return `Today • ${timeStr}`
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday • ${timeStr}`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` • ${timeStr}`
}

export function RecentCaptureCard({ capture }: RecentCaptureCardProps) {
  const { isDark, colors } = useAppTheme()

  const cardBg = isDark ? '#252525' : '#ffffff'
  const cardBorder = isDark ? 'rgba(246,241,230,0.07)' : 'rgba(26,26,26,0.08)'
  const tagBg = isDark ? 'rgba(158,42,43,0.25)' : 'rgba(158,42,43,0.1)'

  const firstTag = capture.capture_tags?.[0]?.tags
  const bodyText = capture.body ?? ''
  const preview = bodyText.length > 160 ? bodyText.slice(0, 160) + '…' : bodyText

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={styles.topRow}>
        <Text style={[styles.timestamp, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
          {formatTimestamp(capture.captured_at)}
        </Text>
        {firstTag && (
          <View style={[styles.tagPill, { backgroundColor: tagBg }]}>
            <Text style={[styles.tagText, { fontFamily: 'Poppins-Medium', color: colors.terra }]}>
              {firstTag.name}
            </Text>
          </View>
        )}
      </View>

      {preview ? (
        <Text style={[styles.body, { fontFamily: 'Merriweather-Regular', color: colors.foreground }]}>
          {preview}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timestamp: {
    fontSize: 12,
    flex: 1,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
})
