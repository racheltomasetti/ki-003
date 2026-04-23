import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { getProjects, createProject, addCaptureToProject } from '@ki/services'
import type { Project } from '@ki/types'

export function useProjects() {
  const { session } = useAuthStore()

  return useQuery({
    queryKey: ['projects', session?.user.id],
    queryFn: async () => {
      const { data, error } = await getProjects(supabase, session!.user.id)
      if (error) throw error
      return data as Project[]
    },
    enabled: !!session,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  const { session } = useAuthStore()

  return useMutation({
    mutationFn: (data: { name: string; color?: string; description?: string }) =>
      createProject(supabase, session!.user.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', session?.user.id] })
    },
  })
}

export function useAddCaptureToProject() {
  const { session } = useAuthStore()

  return useMutation({
    mutationFn: ({ captureId, projectId }: { captureId: string; projectId: string }) =>
      addCaptureToProject(supabase, captureId, projectId, session!.user.id),
  })
}
