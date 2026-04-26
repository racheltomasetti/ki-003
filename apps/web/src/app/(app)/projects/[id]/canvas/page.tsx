import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProject, getCanvasNodes, getCanvasEdges } from '@ki/services'
import { CanvasClient } from './CanvasClient'
import type { Project, CanvasNode, CanvasEdge } from '@ki/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CanvasPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [
    {
      data: { user },
    },
    { data: project },
    { data: nodes },
    { data: edges },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getProject(supabase, id),
    getCanvasNodes(supabase, id),
    getCanvasEdges(supabase, id),
  ])

  if (!user || !project) notFound()

  return (
    <CanvasClient
      projectId={id}
      userId={user.id}
      projectName={(project as Project).name}
      initialNodes={(nodes ?? []) as CanvasNode[]}
      initialEdges={(edges ?? []) as CanvasEdge[]}
    />
  )
}
