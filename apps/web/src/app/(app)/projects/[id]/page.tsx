import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject, getProjectCaptures } from '@ki/services'
import { ProjectDetailClient } from '@/components/ProjectDetailClient'
import type { Project, CaptureWithEnrichment } from '@ki/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: project, error }, { data: captureRows }] = await Promise.all([
    getProject(supabase, id),
    getProjectCaptures(supabase, id),
  ])

  if (error || !project) notFound()

  // Supabase infers the nested join as an array; each capture_projects row has
  // exactly one capture so we take the first element.
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
    />
  )
}
