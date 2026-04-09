import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { getTags, createTag } from '@ki/services'
import type { Tag } from '@ki/types'
import { useAppTheme } from '@/hooks/useAppTheme'

const MAX_IMAGES = 4

interface ReviewCaptureProps {
  transcript: string
  capturedAt: Date
  onTranscriptChange: (text: string) => void
  onSave: (mediaLocalUris: string[], tagIds: string[]) => Promise<void>
  onDiscard: () => void
  isSaving: boolean
}

function formatTimestamp(date: Date): string {
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Today · ${timeStr}`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${timeStr}`
}

export function ReviewCapture({
  transcript,
  capturedAt,
  onTranscriptChange,
  onSave,
  onDiscard,
  isSaving,
}: ReviewCaptureProps) {
  const { isDark, colors } = useAppTheme()
  const { session } = useAuthStore()

  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [mediaUris, setMediaUris] = useState<string[]>([])

  const fg = colors.foreground
  const fgMuted = colors.foregroundMuted
  const borderColor = isDark ? 'rgba(246,241,230,0.1)' : 'rgba(26,26,26,0.1)'
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
  const tagBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const tagActiveBg = colors.terra

  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await getTags(supabase, session.user.id)
      if (cancelled || error || !data) return
      setTags(data)
    })()
    return () => {
      cancelled = true
    }
  }, [session])

  const toggleTag = (id: string) => {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const handleCreateTag = async () => {
    const name = newTagName.trim()
    if (!name || !session) return
    try {
      const { data: tag, error } = await createTag(supabase, session.user.id, name)
      if (error || !tag) throw error ?? new Error('createTag failed')
      setTags(prev => [...prev, tag as Tag])
      setSelectedTagIds(prev => [...prev, tag.id])
      setNewTagName('')
      setShowTagInput(false)
    } catch {
      // Tag may already exist — find and select it
      const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase())
      if (existing && !selectedTagIds.includes(existing.id)) {
        setSelectedTagIds(prev => [...prev, existing.id])
      }
      setNewTagName('')
      setShowTagInput(false)
    }
  }

  const handlePickImage = async () => {
    if (mediaUris.length >= MAX_IMAGES) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      setMediaUris(prev => [...prev, result.assets[0].uri])
    }
  }

  const handleRemoveImage = (uri: string) => {
    setMediaUris(prev => prev.filter(u => u !== uri))
  }

  const handleSave = async () => {
    await onSave(mediaUris, selectedTagIds)
  }

  const handleDiscard = () => {
    Alert.alert(
      'Discard capture?',
      'This thought will not be saved.',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDiscard },
      ]
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleDiscard} hitSlop={12}>
            <Ionicons name="close" size={22} color={fgMuted} />
          </TouchableOpacity>
          <Text style={[styles.headerLabel, { fontFamily: 'Poppins-Medium', color: fgMuted }]}>
            Review
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Timestamp */}
        <Text style={[styles.timestamp, { fontFamily: 'Poppins-Regular', color: fgMuted }]}>
          {formatTimestamp(capturedAt)}
        </Text>

        {/* Transcript */}
        <TextInput
          style={[
            styles.transcript,
            {
              fontFamily: 'Merriweather-Regular',
              color: fg,
              backgroundColor: inputBg,
              borderColor,
            },
          ]}
          value={transcript}
          onChangeText={onTranscriptChange}
          multiline
          placeholder="Your thoughts will appear here…"
          placeholderTextColor={fgMuted}
          scrollEnabled={false}
          textAlignVertical="top"
        />

        {/* Tags */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontFamily: 'Poppins-Medium', color: fgMuted }]}>
            Tags
          </Text>
          <View style={styles.tagRow}>
            {tags.map(tag => {
              const active = selectedTagIds.includes(tag.id)
              return (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => toggleTag(tag.id)}
                  style={[
                    styles.tag,
                    { backgroundColor: active ? tagActiveBg : tagBg },
                  ]}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.tagText,
                      {
                        fontFamily: 'Poppins-Regular',
                        color: active ? '#f6f1e6' : fg,
                      },
                    ]}
                  >
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              )
            })}

            {showTagInput ? (
              <TextInput
                style={[
                  styles.tag,
                  styles.tagInput,
                  { fontFamily: 'Poppins-Regular', backgroundColor: tagBg, color: fg, borderColor },
                ]}
                value={newTagName}
                onChangeText={setNewTagName}
                onSubmitEditing={handleCreateTag}
                onBlur={() => { if (!newTagName.trim()) setShowTagInput(false) }}
                placeholder="Tag name"
                placeholderTextColor={fgMuted}
                autoFocus
                returnKeyType="done"
              />
            ) : (
              <TouchableOpacity
                onPress={() => setShowTagInput(true)}
                style={[styles.tag, { backgroundColor: tagBg }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.tagText, { fontFamily: 'Poppins-Regular', color: fgMuted }]}>
                  + Add tag
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Media */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontFamily: 'Poppins-Medium', color: fgMuted }]}>
            Media
          </Text>
          <View style={styles.mediaRow}>
            {mediaUris.map(uri => (
              <View key={uri} style={styles.mediaThumb}>
                <Image source={{ uri }} style={styles.mediaImage} />
                <TouchableOpacity
                  onPress={() => handleRemoveImage(uri)}
                  style={styles.mediaRemove}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color="#f6f1e6" />
                </TouchableOpacity>
              </View>
            ))}
            {mediaUris.length < MAX_IMAGES && (
              <TouchableOpacity
                onPress={handlePickImage}
                style={[styles.mediaAdd, { backgroundColor: tagBg, borderColor }]}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={24} color={fgMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Save */}
      <View style={[styles.footer, { borderColor }]}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving || !transcript.trim()}
          style={[
            styles.saveButton,
            { opacity: isSaving || !transcript.trim() ? 0.55 : 1 },
          ]}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color="#f6f1e6" />
          ) : (
            <Text style={[styles.saveText, { fontFamily: 'Poppins-SemiBold' }]}>
              Save to Ki
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 24,
    paddingBottom: 12,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  timestamp: {
    fontSize: 12,
  },
  transcript: {
    fontSize: 16,
    lineHeight: 28,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 180,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 13,
  },
  tagInput: {
    minWidth: 80,
    borderWidth: 1,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  mediaAdd: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    backgroundColor: '#9e2a2b',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: {
    color: '#f6f1e6',
    fontSize: 15,
    lineHeight: 22,
  },
})
