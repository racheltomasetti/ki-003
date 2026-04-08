import { Stack } from 'expo-router'

// Root layout — Expo Router takes over from here.
// apps/mobile/App.tsx and apps/mobile/index.ts are no longer used.
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}
