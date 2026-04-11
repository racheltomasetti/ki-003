import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/hooks/useAppTheme'
import { useCaptures } from '@/hooks/useCaptures'
import { RecentCaptureCard } from './RecentCaptureCard'

type CaptureMode = 'voice' | 'text' | 'file'

interface CaptureHubProps {
  selectedMode: CaptureMode
  onModeChange: (mode: CaptureMode) => void
  onCapture: () => void
}

const BAR_HEIGHT = 64
const BAR_BOTTOM = 16
const LIST_BOTTOM_PAD = BAR_HEIGHT + BAR_BOTTOM + 20

const MODES: Array<{ mode: CaptureMode; icon: 'mic' | 'text' | 'attach' }> = [
  { mode: 'voice', icon: 'mic' },
  { mode: 'text',  icon: 'text' },
  { mode: 'file',  icon: 'attach' },
]

export function CaptureHub({ selectedMode, onModeChange, onCapture }: CaptureHubProps) {
  const { isDark, colors } = useAppTheme()
  const { data: response, isLoading } = useCaptures()

  const captures = (response?.data ?? []) as Array<{
    id: string
    captured_at: string
    body: string | null
    type: string
    capture_tags?: Array<{ tag_id: string; tags?: { id: string; name: string } | null }>
  }>

  // Light: white (lighter than cream bg). Dark: slightly lighter than charcoal bg.
  const barBg = isDark ? '#2a2a2a' : '#ffffff'
  const barText = isDark ? '#f6f1e6' : '#1a1a1a'
  // Use rgba(r,g,b,0) instead of 'transparent' — avoids iOS transparent-black artifact
  const bgTransparent = isDark ? 'rgba(26,26,26,0)' : 'rgba(246,241,230,0)'
  const bgOpaque = isDark ? 'rgba(26,26,26,1)' : 'rgba(246,241,230,1)'
  // Grouping pill behind the 3 icons
  const toggleContainerBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(26,26,26,0.06)'
  // Active mode highlight inside the pill
  const modeActiveBg = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(26,26,26,0.09)'

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { fontFamily: 'Poppins-Medium', color: colors.foregroundMuted }]}>
        Recents
      </Text>

      <FlatList
        data={captures}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <RecentCaptureCard capture={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: LIST_BOTTOM_PAD }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { fontFamily: 'Poppins-Regular', color: colors.foregroundSubtle }]}>
                Your captures will appear here.
              </Text>
            </View>
          ) : null
        }
      />

      {/* Short gradient just above the bar */}
      <LinearGradient
        colors={[bgTransparent, bgOpaque]}
        style={styles.barFade}
        pointerEvents="none"
      />
      {/* Fully opaque block behind and beneath the bar */}
      <View style={[styles.barBackdrop, { backgroundColor: bgOpaque }]} pointerEvents="none" />

      {/* Floating capture bar */}
      <View style={[styles.bar, { backgroundColor: barBg, bottom: BAR_BOTTOM }]}>
        {/* Tap to capture — left side */}
        <TouchableOpacity onPress={onCapture} activeOpacity={0.7} style={styles.labelWrap}>
          <Text style={[styles.tapLabel, { fontFamily: 'Poppins-Medium', color: barText }]}>
            Tap to capture
          </Text>
        </TouchableOpacity>

        {/* 3-way mode toggle with grouping pill */}
        <View style={[styles.toggleContainer, { backgroundColor: toggleContainerBg }]}>
          {MODES.map(({ mode, icon }) => (
            <TouchableOpacity
              key={mode}
              onPress={() => onModeChange(mode)}
              activeOpacity={0.7}
              style={[
                styles.modeBtn,
                selectedMode === mode && { backgroundColor: modeActiveBg },
              ]}
            >
              <Ionicons name={icon} size={17} color={barText} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 14,
  },
  barFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BAR_HEIGHT + BAR_BOTTOM,
    height: 40,
  },
  barBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BAR_HEIGHT + BAR_BOTTOM,
  },
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: BAR_HEIGHT,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  labelWrap: {
    flex: 1,
  },
  tapLabel: {
    fontSize: 15,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 4,
    gap: 2,
  },
  modeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
