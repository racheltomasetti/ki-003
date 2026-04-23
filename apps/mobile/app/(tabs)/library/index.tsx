import { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/hooks/useAppTheme'
import { useCaptures } from '@/hooks/useCaptures'
import { RecentCaptureCard } from '@/components/capture/RecentCaptureCard'

export default function LibraryScreen() {
  const { colors } = useAppTheme()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const { data: response, isLoading } = useCaptures({ search: debouncedSearch || undefined })
  const captures = (response?.data ?? []) as Array<{
    id: string
    captured_at: string
    body: string | null
    type: string
    capture_tags?: Array<{ tag_id: string; tags?: { id: string; name: string } | null }>
  }>

  const handleSearchChange = (text: string) => {
    setSearch(text)
    // Simple debounce — wait for user to pause typing
    clearTimeout((handleSearchChange as unknown as { _t?: ReturnType<typeof setTimeout> })._t)
    ;(handleSearchChange as unknown as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
      setDebouncedSearch(text)
    }, 400)
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: 'Merriweather-Bold', color: colors.foreground }]}>
          Library
        </Text>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <Ionicons name="search" size={16} color={colors.foregroundMuted} />
        <TextInput
          style={[styles.searchInput, { fontFamily: 'Poppins-Regular', color: colors.foreground }]}
          placeholder="Search your thoughts…"
          placeholderTextColor={colors.foregroundMuted}
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Feed */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.foregroundMuted} />
      ) : (
        <FlatList
          data={captures}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push(`/library/captures/${item.id}`)}
            >
              <RecentCaptureCard capture={item} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { fontFamily: 'Poppins-Regular', color: colors.foregroundSubtle }]}>
                {search ? 'No captures match your search.' : 'No captures yet. Tap the Ki logo to record your first thought.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 22 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { paddingTop: 80, paddingHorizontal: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
})
