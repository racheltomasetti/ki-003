import { View, Image, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

const LOGO_LIGHT = require('@/assets/logo-light.png')
const LOGO_DARK = require('@/assets/logo-dark.png')

type ThemedLogoProps = {
  isDark: boolean
  size: number
  style?: StyleProp<ViewStyle>
}

/**
 * Both assets stay mounted; crossfade via opacity so theme flips don't wait on decode.
 */
export function ThemedLogo({ isDark, size, style }: ThemedLogoProps) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={LOGO_DARK}
        style={[styles.fill, { opacity: isDark ? 0 : 1 }]}
        resizeMode="contain"
      />
      <Image
        source={LOGO_LIGHT}
        style={[styles.fill, { opacity: isDark ? 1 : 0 }]}
        resizeMode="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
})
