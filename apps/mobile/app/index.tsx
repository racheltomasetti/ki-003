import { Redirect } from 'expo-router'

// Root route — redirect to auth.
// Once authStore is wired: session → /(tabs)/home, no session → /(auth)/sign-in
export default function Index() {
  return <Redirect href="/(auth)/sign-in" />
}
