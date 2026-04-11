import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/hooks/useAppTheme'

interface TextCaptureProps {
  onComplete: () => void
}

export function TextCapture({ onComplete }: TextCaptureProps) {
  const { colors } = useAppTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onComplete} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.foregroundMuted} />
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: 'Poppins-Medium', color: colors.foregroundMuted }]}>
          Text
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.comingSoon, { fontFamily: 'Merriweather-Regular', color: colors.foregroundSubtle }]}>
          Text capture coming soon.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoon: {
    fontSize: 16,
  },
})
