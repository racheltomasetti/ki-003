import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@ki/services'
import { ProfileClient } from '@/components/ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const profile = await getProfile(supabase, user.id)
  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'You'

  return (
    <ProfileClient
      profile={profile}
      userEmail={user.email ?? ''}
      displayName={displayName}
    />
  )
}
