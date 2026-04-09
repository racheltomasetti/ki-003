import { SafeAreaView } from 'react-native-safe-area-context'
import { VoiceCapture } from '@/components/capture/VoiceCapture'
import { useAppTheme } from '@/hooks/useAppTheme'

export default function CaptureScreen() {
  const { colors } = useAppTheme()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <VoiceCapture />
    </SafeAreaView>
  )
}
