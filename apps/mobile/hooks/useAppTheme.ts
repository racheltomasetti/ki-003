import { useColorScheme, type ColorSchemeName } from 'react-native'
import { useMemo } from 'react'
import { getAppThemeColors, type AppThemeColors } from '@/theme/colors'

export type AppTheme = {
  colorScheme: ColorSchemeName
  isDark: boolean
  colors: AppThemeColors
}

/**
 * Single source of truth for light/dark so tab bar + screens repaint together.
 * Prefer this over NativeWind `dark:` on screens that sit above the tab bar —
 * `darkMode: 'media'` can update a frame later than JS `useColorScheme`.
 */
export function useAppTheme(): AppTheme {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const colors = useMemo(() => getAppThemeColors(isDark), [isDark])
  return { colorScheme, isDark, colors }
}
