import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-charcoal">
      <View className="flex-1 px-6 pt-6">
        <Text
          style={{ fontFamily: 'Merriweather-Bold' }}
          className="text-2xl text-charcoal dark:text-cream"
        >
          Library
        </Text>
        <Text
          style={{ fontFamily: 'Poppins-Regular' }}
          className="text-charcoal/50 dark:text-cream/50 text-sm mt-1"
        >
          Your captures will appear here.
        </Text>
      </View>
    </SafeAreaView>
  )
}
