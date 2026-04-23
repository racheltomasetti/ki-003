import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '@/hooks/useAppTheme'
import { VoiceCapture } from '@/components/capture/VoiceCapture'

export default function CaptureScreen() {
  const { colors } = useAppTheme()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <VoiceCapture />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
