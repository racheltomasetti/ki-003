import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPursuit, getCanvasNodes, getCanvasEdges } from '@ki/services'
import { CanvasClient } from './CanvasClient'
import type { Pursuit, CanvasNode, CanvasEdge } from '@ki/types'

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
    getPursuit(supabase, id),
    getCanvasNodes(supabase, id),
    getCanvasEdges(supabase, id),
  ])

  if (!user || !project) notFound()

  return (
    <CanvasClient
      projectId={id}
      userId={user.id}
      projectName={(project as Pursuit).name}
      initialNodes={(nodes ?? []) as CanvasNode[]}
      initialEdges={(edges ?? []) as CanvasEdge[]}
    />
  )
}
