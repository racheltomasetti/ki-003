import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject } from '@ki/services'
import { ProjectSettingsClient } from '@/components/ProjectSettingsClient'
import type { Project } from '@ki/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectSettingsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project, error } = await getProject(supabase, id)
  if (error || !project) notFound()

  return <ProjectSettingsClient project={project as Project} />
}
