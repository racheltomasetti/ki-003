import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getProfile, updateProfile } from '@ki/services'
import type { Profile } from '@ki/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  initialize: () => () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,

  initialize: () => {
    // Restore existing session on launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, isLoading: false })
      if (session) {
        getProfile(supabase, session.user.id).then((profile) => set({ profile }))
      }
    })

    // Keep session in sync with Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        set({ session })
        if (session) {
          getProfile(supabase, session.user.id).then((profile) => set({ profile }))
        } else {
          set({ profile: null })
        }
      }
    )

    return () => subscription.unsubscribe()
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },

  signUp: async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    // Profile row is created by Postgres trigger. Write display_name immediately
    // if we have a session (email confirmation disabled in dev).
    if (data.user && displayName.trim()) {
      await updateProfile(supabase, data.user.id, { display_name: displayName.trim() })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },
}))
