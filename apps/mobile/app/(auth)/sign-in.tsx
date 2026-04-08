import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { useAuthStore } from '@/store/authStore'

export default function SignIn() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const { signIn } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      // Routing handled by root _layout session watcher
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  const placeholderColor = isDark ? 'rgba(246,241,230,0.35)' : 'rgba(26,26,26,0.35)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const borderColor = isDark ? 'rgba(246,241,230,0.15)' : 'rgba(26,26,26,0.15)'

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-charcoal">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-8 justify-center">

          {/* Wordmark */}
          <View className="mb-16">
            <Text
              style={{ fontFamily: 'Merriweather-Bold', lineHeight: 72 }}
              className="text-5xl text-charcoal dark:text-cream"
            >
              Ki
            </Text>
            <Text
              style={{ fontFamily: 'Poppins-Regular' }}
              className="text-sm text-charcoal/50 dark:text-cream/50 mt-1"
            >
              A living extension of your mind.
            </Text>
          </View>

          {/* Form */}
          <View className="gap-3">
            <TextInput
              style={{
                fontFamily: 'Poppins-Regular',
                backgroundColor: inputBg,
                borderColor,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: isDark ? '#f6f1e6' : '#1a1a1a',
              }}
              placeholder="Email"
              placeholderTextColor={placeholderColor}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <TextInput
              style={{
                fontFamily: 'Poppins-Regular',
                backgroundColor: inputBg,
                borderColor,
                borderWidth: 1,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: isDark ? '#f6f1e6' : '#1a1a1a',
              }}
              placeholder="Password"
              placeholderTextColor={placeholderColor}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            {error ? (
              <Text
                style={{ fontFamily: 'Poppins-Regular' }}
                className="text-terra text-sm"
              >
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={handleSignIn}
              disabled={loading}
              className="bg-terra rounded-xl py-4 items-center mt-2"
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#f6f1e6" />
              ) : (
                <Text
                  style={{ fontFamily: 'Poppins-SemiBold', lineHeight: 22 }}
                  className="text-cream text-base"
                >
                  Sign in
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Dev-only: switch to sign-up. Hidden in production builds. */}
          {__DEV__ && (
            <View className="flex-row justify-center items-center mt-8">
              <Text
                style={{ fontFamily: 'Poppins-Regular' }}
                className="text-charcoal/50 dark:text-cream/50 text-sm"
              >
                No account?{' '}
              </Text>
              <Link href="/(auth)/sign-up" asChild>
                <TouchableOpacity style={{ paddingVertical: 2, paddingRight: 4, marginLeft: 2 }}>
                  <Text
                    style={{ fontFamily: 'Poppins-Medium', lineHeight: 20 }}
                    className="text-pacific text-sm"
                  >
                    Sign up
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
