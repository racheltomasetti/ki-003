import '../global.css'
import { useEffect } from 'react'
import { useSegments, useRouter, SplashScreen, Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import {
  Merriweather_400Regular,
  Merriweather_700Bold,
} from '@expo-google-fonts/merriweather'
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins'
import { useAuthStore } from '@/store/authStore'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60, retry: 2 } },
})

export default function RootLayout() {
  const { session, isLoading, initialize } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  const [fontsLoaded] = useFonts({
    'Merriweather-Regular': Merriweather_400Regular,
    'Merriweather-Bold': Merriweather_700Bold,
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
  })

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!fontsLoaded) return
    SplashScreen.hideAsync()
  }, [fontsLoaded])

  useEffect(() => {
    if (isLoading || !fontsLoaded) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/home')
    }
  }, [session, isLoading, fontsLoaded, segments])

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
