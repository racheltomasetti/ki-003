import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { getActivePursuits, createPursuit, addCaptureToPursuit, getPursuitCaptures, removeCaptureFromPursuit } from '@ki/services'
import type { Pursuit, CaptureWithEnrichment } from '@ki/types'

export function usePursuits() {
  const { session } = useAuthStore()

  return useQuery({
    queryKey: ['pursuits', session?.user.id],
    queryFn: async () => {
      const { data, error } = await getActivePursuits(supabase, session!.user.id)
      if (error) throw error
      return data as Pursuit[]
    },
    enabled: !!session,
  })
}

export function useCreatePursuit() {
  const queryClient = useQueryClient()
  const { session } = useAuthStore()

  return useMutation({
    mutationFn: (data: { name: string; color?: string; description?: string }) =>
      createPursuit(supabase, session!.user.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pursuits', session?.user.id] })
    },
  })
}

export function useAddCaptureToPursuit() {
  const { session } = useAuthStore()

  return useMutation({
    mutationFn: ({ captureId, pursuitId }: { captureId: string; pursuitId: string }) =>
      addCaptureToPursuit(supabase, captureId, pursuitId, session!.user.id),
  })
}

export function usePursuitCaptures(pursuitId: string) {
  return useQuery({
    queryKey: ['pursuit-captures', pursuitId],
    queryFn: async () => {
      const { data, error } = await getPursuitCaptures(supabase, pursuitId)
      if (error) throw error
      return (data ?? [])
        .map((row: { capture_id: string; captures: unknown }) => row.captures)
        .filter(Boolean) as CaptureWithEnrichment[]
    },
    enabled: !!pursuitId,
  })
}

export function useRemoveCaptureFromPursuit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ captureId, pursuitId }: { captureId: string; pursuitId: string }) =>
      removeCaptureFromPursuit(supabase, captureId, pursuitId),
    onSuccess: (_data, { pursuitId }) => {
      queryClient.invalidateQueries({ queryKey: ['pursuit-captures', pursuitId] })
    },
  })
}

