import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { getProjects, createProject, addCaptureToProject, getProjectCaptures, removeCaptureFromProject } from '@ki/services'
import type { Project, CaptureWithEnrichment } from '@ki/types'

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

export function useProjectCaptures(projectId: string) {
  return useQuery({
    queryKey: ['project-captures', projectId],
    queryFn: async () => {
      const { data, error } = await getProjectCaptures(supabase, projectId)
      if (error) throw error
      return (data ?? [])
        .map((row: { capture_id: string; captures: unknown }) => row.captures)
        .filter(Boolean) as CaptureWithEnrichment[]
    },
    enabled: !!projectId,
  })
}

export function useRemoveCaptureFromProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ captureId, projectId }: { captureId: string; projectId: string }) =>
      removeCaptureFromProject(supabase, captureId, projectId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project-captures', projectId] })
    },
  })
}

export function useGenerateBrief() {
  const queryClient = useQueryClient()
  const { session } = useAuthStore()

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-brief', {
        body: { project_id: projectId },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as { brief: string; capture_count: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', session?.user.id] })
    },
  })
}
