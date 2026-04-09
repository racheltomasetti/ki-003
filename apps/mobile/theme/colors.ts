/** Semantic colors — keep in sync with tab bar and capture surfaces. */

export type AppThemeColors = {
  background: string
  foreground: string
  foregroundMuted: string
  foregroundSubtle: string
  tabBarBorder: string
  tabInactive: string
  terra: string
}

export function getAppThemeColors(isDark: boolean): AppThemeColors {
  return {
    background: isDark ? '#1a1a1a' : '#f6f1e6',
    foreground: isDark ? '#f6f1e6' : '#1a1a1a',
    foregroundMuted: isDark ? 'rgba(246,241,230,0.5)' : 'rgba(26,26,26,0.5)',
    foregroundSubtle: isDark ? 'rgba(246,241,230,0.35)' : 'rgba(26,26,26,0.35)',
    tabBarBorder: isDark ? '#2a2a2a' : '#e8e3d8',
    tabInactive: isDark ? 'rgba(246,241,230,0.35)' : 'rgba(26,26,26,0.35)',
    terra: '#9e2a2b',
  }
}
