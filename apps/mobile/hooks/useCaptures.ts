import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { getCaptures, createCapture, addTagToCapture } from '@ki/services'
import type { CaptureInsert, CaptureStatus } from '@ki/types'
import type { GetCapturesOptions } from '@ki/services'

export function useCaptures(options: Omit<GetCapturesOptions, 'status'> & { status?: CaptureStatus } = {}) {
  const { session } = useAuthStore()
  const { status = 'active', ...rest } = options

  return useQuery({
    queryKey: ['captures', session?.user.id, status, rest],
    queryFn: () => getCaptures(supabase, { status, ...rest }),
    enabled: !!session,
  })
}

export function useCreateCapture() {
  const queryClient = useQueryClient()
  const { session } = useAuthStore()

  return useMutation({
    mutationFn: (capture: Omit<CaptureInsert, 'user_id'>) =>
      createCapture(supabase, { ...capture, user_id: session!.user.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['captures', session?.user.id] })
    },
  })
}

export function useAddTagToCapture() {
  const { session } = useAuthStore()

  return useMutation({
    mutationFn: ({ captureId, tagId }: { captureId: string; tagId: string }) =>
      addTagToCapture(supabase, captureId, tagId, session!.user.id),
  })
}
