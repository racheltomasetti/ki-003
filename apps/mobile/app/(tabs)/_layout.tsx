import { Tabs } from 'expo-router'
import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import { useAppTheme } from '@/hooks/useAppTheme'

const TAB_ICON_SIZE = 24
const CAPTURE_ICON_SIZE = 28
const PROFILE_ICON_SIZE = 20

export default function TabsLayout() {
  const { colors } = useAppTheme()

  const bg = colors.background
  const border = colors.tabBarBorder
  const active = colors.terra
  const inactive = colors.tabInactive

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: border,
          borderTopWidth: 1,
          paddingBottom: 4,
        },
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: {
          fontFamily: 'Poppins-Medium',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="compass" solid size={TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="capture/index"
        options={{
          title: 'Capture',
          tabBarLabel: 'Capture',
          tabBarIcon: ({ color }) => (
            <Ionicons name="add-circle-outline" size={CAPTURE_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="user" solid size={PROFILE_ICON_SIZE} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
