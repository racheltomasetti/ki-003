import { TouchableOpacity, StyleSheet, Vibration } from 'react-native'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import { ThemedLogo } from '@/components/capture/ThemedLogo'
import { useAppTheme } from '@/hooks/useAppTheme'

export function KiTabButton({ onPress, onLongPress }: BottomTabBarButtonProps) {
  const handlePress =
    onPress == null
      ? undefined
      : (event: Parameters<NonNullable<BottomTabBarButtonProps['onPress']>>[0]) => {
          Vibration.vibrate(3)
          onPress(event)
        }
  const handleLongPress = onLongPress ?? undefined
  const { isDark } = useAppTheme()

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.75}
      style={styles.wrapper}
    >
      <ThemedLogo isDark={!isDark} size={86} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -16,
  },
})
