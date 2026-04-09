import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '@/hooks/useAppTheme'

export default function HomeScreen() {
  const { colors } = useAppTheme()

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>Library</Text>
        <Text style={[styles.subtitle, { color: colors.foregroundMuted }]}>Your captures will appear here.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { fontFamily: 'Merriweather-Bold', fontSize: 24 },
  subtitle: { fontFamily: 'Poppins-Regular', fontSize: 14, marginTop: 4 },
})
