import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CaptureScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-charcoal">
      <View className="flex-1 items-center justify-center px-6">
        <Text
          style={{ fontFamily: 'Merriweather-Bold' }}
          className="text-2xl text-charcoal dark:text-cream"
        >
          Capture
        </Text>
        <Text
          style={{ fontFamily: 'Poppins-Regular' }}
          className="text-charcoal/50 dark:text-cream/50 text-sm mt-2 text-center"
        >
          Voice, text, and file capture coming next.
        </Text>
      </View>
    </SafeAreaView>
  )
}
