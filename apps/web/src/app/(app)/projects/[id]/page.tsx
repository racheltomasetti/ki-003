import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject, getProjectCaptures, getProjectConversation } from '@ki/services'
import { ProjectDetailClient } from '@/components/ProjectDetailClient'
import type { Project, CaptureWithEnrichment, ProjectConversation } from '@ki/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: project, error },
    { data: captureRows },
    messages,
  ] = await Promise.all([
    getProject(supabase, id),
    getProjectCaptures(supabase, id),
    getProjectConversation(supabase, id).catch(() => [] as ProjectConversation[]),
  ])

  if (error || !project) notFound()

  const captures = (captureRows ?? [])
    .map((row) => {
      const raw = row.captures
      return (Array.isArray(raw) ? raw[0] : raw) as unknown as CaptureWithEnrichment | undefined
    })
    .filter((c): c is CaptureWithEnrichment => Boolean(c))

  return (
    <ProjectDetailClient
      project={project as Project}
      captures={captures}
      messages={messages}
    />
  )
}
