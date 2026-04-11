import { useState, useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useAppTheme } from '@/hooks/useAppTheme'
import { CaptureHub } from '@/components/capture/CaptureHub'
import { VoiceCapture } from '@/components/capture/VoiceCapture'
import { TextCapture } from '@/components/capture/TextCapture'
import { FileCapture } from '@/components/capture/FileCapture'

type CaptureMode = 'voice' | 'text' | 'file'

export default function CaptureScreen() {
  const { colors } = useAppTheme()
  const navigation = useNavigation()
  const [activeMode, setActiveMode] = useState<CaptureMode | null>(null)
  const [selectedMode, setSelectedMode] = useState<CaptureMode>('voice')

  const isImmersive = activeMode !== null

  useEffect(() => {
    const parent = navigation.getParent()
    if (!parent) return
    if (isImmersive) {
      parent.setOptions({ tabBarStyle: { display: 'none' } })
    } else {
      parent.setOptions({
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: 4,
        },
      })
    }
  }, [isImmersive, colors, navigation])

  const handleComplete = () => setActiveMode(null)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {activeMode === 'voice' && <VoiceCapture onComplete={handleComplete} />}
      {activeMode === 'text'  && <TextCapture  onComplete={handleComplete} />}
      {activeMode === 'file'  && <FileCapture  onComplete={handleComplete} />}
      {activeMode === null && (
        <CaptureHub
          selectedMode={selectedMode}
          onModeChange={setSelectedMode}
          onCapture={() => setActiveMode(selectedMode)}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
