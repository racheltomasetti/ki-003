import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/hooks/useAppTheme'
import { supabase } from '@/lib/supabase'

type Role = 'user' | 'ki'

interface Citation {
  id: string
  captured_at: string
  title: string | null
  similarity: number
}

interface Message {
  id: string
  role: Role
  content: string
  citations?: Citation[]
}

export default function ChatScreen() {
  const { colors } = useAppTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const listRef = useRef<FlatList>(null)

  const borderColor = colors.cardBorder

  const send = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    const history = messages.map(m => ({ role: m.role === 'ki' ? 'assistant' : 'user', content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-ki', {
        body: { message: text, history },
      })

      if (error) throw error

      const kiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ki',
        content: data.response,
        citations: data.citations ?? [],
      }
      setMessages(prev => [...prev, kiMsg])
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ki',
        content: 'Something went wrong. Try again.',
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user'

    return (
      <View style={[styles.msgWrap, isUser ? styles.msgRight : styles.msgLeft]}>
        <View style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.terra }
            : { backgroundColor: colors.cardBg, borderWidth: 1, borderColor },
        ]}>
          <Text style={[
            styles.bubbleText,
            { fontFamily: isUser ? 'Poppins-Regular' : 'Merriweather-Regular' },
            { color: isUser ? '#f6f1e6' : colors.foreground },
          ]}>
            {item.content}
          </Text>
        </View>

        {/* Citations */}
        {!isUser && item.citations && item.citations.length > 0 && (
          <View style={styles.citationsWrap}>
            {item.citations.map(c => (
              <View key={c.id} style={[styles.citationPill, { borderColor }]}>
                <Text style={[styles.citationText, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
                  {c.title ?? new Date(c.captured_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: 'Merriweather-Bold', color: colors.foreground }]}>
          Chat with Ki
        </Text>
        <Text style={[styles.subtitle, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
          Ask anything about your thoughts.
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          renderItem={renderMessage}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { fontFamily: 'Merriweather-Regular', color: colors.foregroundMuted }]}>
                Your thoughts are waiting.
              </Text>
              <Text style={[styles.emptyHint, { fontFamily: 'Poppins-Regular', color: colors.foregroundSubtle }]}>
                Ask Ki anything — about patterns in your thinking, ideas you've explored, or what's been on your mind.
              </Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {isLoading && (
          <View style={styles.typingWrap}>
            <ActivityIndicator size="small" color={colors.foregroundMuted} />
            <Text style={[styles.typingText, { fontFamily: 'Poppins-Regular', color: colors.foregroundMuted }]}>
              Ki is thinking…
            </Text>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputRow, { borderColor, backgroundColor: colors.background }]}>
          <TextInput
            style={[
              styles.input,
              { fontFamily: 'Poppins-Regular', color: colors.foreground, backgroundColor: colors.cardBg, borderColor },
            ]}
            placeholder="Ask Ki about your thoughts…"
            placeholderTextColor={colors.foregroundMuted}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={send}
            blurOnSubmit
          />
          <TouchableOpacity
            onPress={send}
            disabled={!input.trim() || isLoading}
            style={[styles.sendBtn, { backgroundColor: colors.terra, opacity: !input.trim() || isLoading ? 0.4 : 1 }]}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={18} color="#f6f1e6" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 2,
  },
  title: { fontSize: 22 },
  subtitle: { fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  listEmpty: { flex: 1, justifyContent: 'center' },
  empty: { padding: 32, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 17, textAlign: 'center' },
  emptyHint: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  msgWrap: { marginBottom: 12, maxWidth: '85%' },
  msgRight: { alignSelf: 'flex-end' },
  msgLeft: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleText: { fontSize: 15, lineHeight: 24 },
  citationsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingLeft: 4 },
  citationPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  citationText: { fontSize: 11 },
  typingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingBottom: 8 },
  typingText: { fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
