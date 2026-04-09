import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/store/authStore'
import { useAppTheme } from '@/hooks/useAppTheme'

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore()
  const { colors } = useAppTheme()

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        {profile?.display_name ? (
          <Text style={[styles.name, { color: colors.foregroundMuted }]}>{profile.display_name}</Text>
        ) : null}

        <TouchableOpacity onPress={signOut} style={styles.signOut} activeOpacity={0.7}>
          <Text style={[styles.signOutLabel, { color: colors.terra }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { fontFamily: 'Merriweather-Bold', fontSize: 24 },
  name: { fontFamily: 'Poppins-Regular', fontSize: 14, marginTop: 4 },
  signOut: { marginTop: 40, alignSelf: 'flex-start' },
  signOutLabel: { fontFamily: 'Poppins-Medium', fontSize: 14 },
})
