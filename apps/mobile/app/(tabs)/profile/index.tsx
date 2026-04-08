import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/store/authStore'

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore()

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-charcoal">
      <View className="flex-1 px-6 pt-6">
        <Text
          style={{ fontFamily: 'Merriweather-Bold' }}
          className="text-2xl text-charcoal dark:text-cream"
        >
          Profile
        </Text>
        {profile?.display_name ? (
          <Text
            style={{ fontFamily: 'Poppins-Regular' }}
            className="text-charcoal/60 dark:text-cream/60 text-sm mt-1"
          >
            {profile.display_name}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={signOut}
          className="mt-10 self-start"
          activeOpacity={0.7}
        >
          <Text
            style={{ fontFamily: 'Poppins-Medium' }}
            className="text-terra text-sm"
          >
            Sign out
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
