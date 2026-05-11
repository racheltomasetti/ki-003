import { useState, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/hooks/useAppTheme'
import { usePursuits, usePursuitCaptures } from '@/hooks/useProjects'
import type { Pursuit, CaptureWithEnrichment } from '@ki/types'

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return `Today · ${timeStr}`
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${timeStr}`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${timeStr}`
}

interface CaptureCardProps {
  capture: CaptureWithEnrichment
  onPress: () => void
}

function CaptureCard({ capture, onPress }: CaptureCardProps) {
  const { colors } = useAppTheme()
  const preview = (capture.body ?? '').slice(0, 180)
  const truncated = (capture.body ?? '').length > 180

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
    >
      <Text style={[styles.cardTimestamp, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
        {formatTimestamp(capture.captured_at)}
        {capture.is_starred ? '  ★' : ''}
      </Text>
      {preview ? (
        <Text style={[styles.cardBody, { fontFamily: 'Merriweather-Regular', color: colors.foreground }]}>
          {preview}{truncated ? '…' : ''}
        </Text>
      ) : null}
      {capture.capture_tags && capture.capture_tags.length > 0 && (
        <View style={styles.tagRow}>
          {capture.capture_tags.slice(0, 3).map(ct => ct.tags ? (
            <View key={ct.tag_id} style={[styles.tagPill, { backgroundColor: colors.cardBorder }]}>
              <Text style={[styles.tagText, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
                {ct.tags.name}
              </Text>
            </View>
          ) : null)}
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { colors } = useAppTheme()

  const { data: projects } = usePursuits()
  const { data: captures, isLoading } = usePursuitCaptures(id)

  const project = projects?.find((p: Pursuit) => p.id === id)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of (captures ?? []) as CaptureWithEnrichment[]) {
      for (const ct of c.capture_tags ?? []) {
        if (ct.tags) map.set(ct.tags.id, ct.tags.name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [captures])

  const filtered = useMemo(() => {
    if (!activeTag) return captures ?? []
    return (captures ?? [] as CaptureWithEnrichment[]).filter((c: CaptureWithEnrichment) =>
      c.capture_tags?.some(ct => ct.tag_id === activeTag)
    )
  }, [captures, activeTag])

  const accentColor = project?.color ?? colors.terra

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { fontFamily: 'Merriweather-Bold', color: colors.foreground }]}
          numberOfLines={1}
        >
          {project?.name ?? ''}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.metaBar, { borderLeftColor: accentColor }]}>
        <Text style={[styles.metaCount, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
          {isLoading ? '—' : `${filtered.length} capture${filtered.length !== 1 ? 's' : ''}`}
        </Text>
        {project?.description ? (
          <Text style={[styles.metaDesc, { fontFamily: 'Poppins-Regular', color: colors.foregroundSubtle }]}>
            {project.description}
          </Text>
        ) : null}
      </View>

      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagStrip}
          contentContainerStyle={styles.tagScroll}
        >
          <TouchableOpacity
            onPress={() => setActiveTag(null)}
            style={[
              styles.filterPill,
              { borderColor: colors.cardBorder },
              !activeTag && { backgroundColor: accentColor, borderColor: accentColor },
            ]}
          >
            <Text style={[
              styles.filterText,
              { fontFamily: 'Poppins-Medium', color: !activeTag ? '#fff' : colors.foregroundMuted },
            ]}>
              All
            </Text>
          </TouchableOpacity>
          {allTags.map(tag => (
            <TouchableOpacity
              key={tag.id}
              onPress={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
              style={[
                styles.filterPill,
                { borderColor: colors.cardBorder },
                activeTag === tag.id && { backgroundColor: accentColor, borderColor: accentColor },
              ]}
            >
              <Text style={[
                styles.filterText,
                { fontFamily: 'Poppins-Medium', color: activeTag === tag.id ? '#fff' : colors.foregroundMuted },
              ]}>
                {tag.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.foregroundMuted} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          style={styles.captureList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { fontFamily: 'Merriweather-Regular', color: colors.foregroundMuted }]}>
                No captures yet.
              </Text>
              <Text style={[styles.emptyHint, { fontFamily: 'Poppins-Regular', color: colors.foregroundSubtle }]}>
                Assign captures to this project when you record.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CaptureCard
              capture={item}
              onPress={() => router.push(`/library/captures/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    textAlign: 'center',
  },
  headerSpacer: { width: 34 },
  metaBar: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 3,
    gap: 2,
  },
  metaCount: { fontSize: 13 },
  metaDesc: { fontSize: 12 },
  tagStrip: { flexGrow: 0, flexShrink: 0 },
  tagScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13 },
  captureList: { flex: 1, marginTop: 4 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  cardTimestamp: { fontSize: 12 },
  cardBody: { fontSize: 14, lineHeight: 22 },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tagPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  tagText: { fontSize: 11 },
  empty: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 16, textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
})
