import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getCapture } from '@ki/services'
import { useAppTheme } from '@/hooks/useAppTheme'
import type { CaptureWithEnrichment } from '@ki/types'

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) +
    ' · ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function EnrichmentBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: color + '20' }]}>
      <Text style={[badgeStyles.label, { color }]}>{label}</Text>
      <Text style={[badgeStyles.value, { color }]}>{value}</Text>
    </View>
  )
}

const badgeStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignItems: 'center' },
  label: { fontFamily: 'Poppins-Medium', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8 },
  value: { fontFamily: 'Poppins-Regular', fontSize: 12, marginTop: 1 },
})

export default function CaptureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { colors } = useAppTheme()

  const { data, isLoading } = useQuery({
    queryKey: ['capture', id],
    queryFn: async () => {
      const { data, error } = await getCapture(supabase, id)
      if (error) throw error
      return data as CaptureWithEnrichment
    },
  })

  const borderColor = colors.cardBorder
  const enrichment = data?.enrichments

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.foregroundMuted} />
      ) : !data ? null : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Timestamp + type */}
          <Text style={[styles.meta, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
            {formatDate(data.captured_at)}
          </Text>

          {/* Tags */}
          {data.capture_tags && data.capture_tags.length > 0 && (
            <View style={styles.tagRow}>
              {data.capture_tags.map(ct => ct.tags ? (
                <View key={ct.tag_id} style={[styles.tagPill, { backgroundColor: colors.terra + '18' }]}>
                  <Text style={[styles.tagText, { fontFamily: 'Poppins-Medium', color: colors.terra }]}>
                    {ct.tags.name}
                  </Text>
                </View>
              ) : null)}
            </View>
          )}

          {/* Body */}
          <Text style={[styles.body, { fontFamily: 'Merriweather-Regular', color: colors.foreground }]}>
            {data.body}
          </Text>

          {/* Enrichment */}
          {enrichment && enrichment.enrichment_status === 'complete' && (
            <View style={[styles.enrichSection, { borderColor }]}>
              <Text style={[styles.enrichLabel, { fontFamily: 'Poppins-Medium', color: colors.foregroundMuted }]}>
                Ki extracted
              </Text>

              {/* Summary */}
              {enrichment.summary && (
                <View style={[styles.summaryCard, { backgroundColor: colors.cardBg, borderColor }]}>
                  <Text style={[styles.summaryText, { fontFamily: 'Merriweather-Regular', color: colors.foreground }]}>
                    {enrichment.summary}
                  </Text>
                </View>
              )}

              {/* Badges row */}
              <View style={styles.badgeRow}>
                {enrichment.capture_intent && (
                  <EnrichmentBadge label="Intent" value={enrichment.capture_intent} color={colors.pacific} />
                )}
                {enrichment.sentiment && (
                  <EnrichmentBadge label="Sentiment" value={enrichment.sentiment} color={colors.sage} />
                )}
                {enrichment.energy_level && (
                  <EnrichmentBadge label="Energy" value={enrichment.energy_level} color={colors.ray} />
                )}
              </View>

              {/* Themes */}
              {enrichment.themes && enrichment.themes.length > 0 && (
                <View style={styles.themesWrap}>
                  {enrichment.themes.map((theme, i) => (
                    <View key={i} style={[styles.themePill, { backgroundColor: colors.cardBg, borderColor }]}>
                      <Text style={[styles.themeText, { fontFamily: 'Poppins-Regular', color: colors.foreground }]}>
                        {theme}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Key quotes */}
              {enrichment.key_quotes && enrichment.key_quotes.length > 0 && (
                <View style={styles.quotesWrap}>
                  {enrichment.key_quotes.map((q, i) => (
                    <View key={i} style={[styles.quoteCard, { borderLeftColor: colors.terra }]}>
                      <Text style={[styles.quoteText, { fontFamily: 'Merriweather-Regular', color: colors.foregroundMuted }]}>
                        "{q}"
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Questions raised */}
              {enrichment.questions_raised && enrichment.questions_raised.length > 0 && (
                <View style={styles.questionsWrap}>
                  <Text style={[styles.subLabel, { fontFamily: 'Poppins-Medium', color: colors.foregroundMuted }]}>
                    Questions raised
                  </Text>
                  {enrichment.questions_raised.map((q, i) => (
                    <Text key={i} style={[styles.questionText, { fontFamily: 'Poppins-Regular', color: colors.foreground }]}>
                      {i + 1}. {q}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {enrichment?.enrichment_status === 'pending' && (
            <View style={styles.pendingWrap}>
              <ActivityIndicator size="small" color={colors.foregroundMuted} />
              <Text style={[styles.pendingText, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
                Ki is thinking…
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  content: { paddingHorizontal: 24, paddingBottom: 48, gap: 20 },
  meta: { fontSize: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 12 },
  body: { fontSize: 16, lineHeight: 30 },
  enrichSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20, gap: 16 },
  enrichLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  summaryText: { fontSize: 14, lineHeight: 24 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  themesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  themeText: { fontSize: 13 },
  quotesWrap: { gap: 10 },
  quoteCard: { borderLeftWidth: 3, paddingLeft: 12 },
  quoteText: { fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  questionsWrap: { gap: 6 },
  subLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  questionText: { fontSize: 14, lineHeight: 22 },
  pendingWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  pendingText: { fontSize: 14 },
})
