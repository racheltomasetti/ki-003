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

export default function SignUp() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const { signUp } = useAuthStore()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await signUp(email.trim(), password, name)
      // If email confirmation is enabled, show a message.
      // If disabled, root _layout session watcher will redirect automatically.
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed.')
    } finally {
      setLoading(false)
    }
  }

  const placeholderColor = isDark ? 'rgba(246,241,230,0.35)' : 'rgba(26,26,26,0.35)'
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const borderColor = isDark ? 'rgba(246,241,230,0.15)' : 'rgba(26,26,26,0.15)'

  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-cream dark:bg-charcoal">
        <View className="flex-1 px-8 justify-center">
          <Text
            style={{ fontFamily: 'Merriweather-Bold' }}
            className="text-3xl text-charcoal dark:text-cream mb-4"
          >
            Check your email.
          </Text>
          <Text
            style={{ fontFamily: 'Poppins-Regular' }}
            className="text-charcoal/60 dark:text-cream/60 text-base leading-relaxed"
          >
            We sent a confirmation link to{' '}
            <Text className="text-charcoal dark:text-cream">{email}</Text>.
            {'\n\n'}Open it and you're in.
          </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity className="mt-10">
              <Text
                style={{ fontFamily: 'Poppins-Medium' }}
                className="text-pacific text-sm"
              >
                Back to sign in
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SafeAreaView>
    )
  }

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
              placeholder="Name"
              placeholderTextColor={placeholderColor}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
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
              autoComplete="new-password"
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
              placeholder="Confirm password"
              placeholderTextColor={placeholderColor}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
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
              onPress={handleSignUp}
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
                  Create account
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Dev-only: switch to sign-in. Hidden in production builds. */}
          {__DEV__ && (
          <View className="flex-row justify-center items-center mt-8">
            <Text
              style={{ fontFamily: 'Poppins-Regular' }}
              className="text-charcoal/50 dark:text-cream/50 text-sm"
            >
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity style={{ paddingVertical: 2, paddingRight: 4 }}>
                <Text
                  style={{ fontFamily: 'Poppins-Medium', lineHeight: 20 }}
                  className="text-pacific text-sm"
                >
                  Sign in
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
