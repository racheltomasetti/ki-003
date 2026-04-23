import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import { useAppTheme } from '@/hooks/useAppTheme'
import { KiTabButton } from '@/components/tabs/KiTabButton'

const ICON_SIZE = 30

export default function TabsLayout() {
  const { isDark, colors } = useAppTheme()

  // Tab bar sits as a floating card — white on light, elevated dark on dark.
  // Shadow goes upward (negative Y) to create the lifted-from-content look.
  const tabBarBg = isDark ? '#252525' : '#ffffff'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 20,
          paddingTop: 3,
          // iOS shadow — upward so it separates from content below
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 16,
          // Android elevation
          elevation: 12,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.terra,
        tabBarInactiveTintColor: colors.tabInactive,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <FontAwesome name="home" size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          tabBarLabel: 'Library',
          tabBarIcon: ({ color }) => (
            <Ionicons name="layers-outline" size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          tabBarLabel: '',
          tabBarButton: (props) => <KiTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => (
            <Ionicons name="compass-outline" size={ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="user-large" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
