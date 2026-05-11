import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPursuit, getPursuitCaptures, getPursuitConversation } from '@ki/services'
import { PursuitDetailClient } from '@/components/PursuitDetailClient'
import type { Pursuit, CaptureWithEnrichment, PursuitConversation } from '@ki/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PursuitDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: pursuit, error },
    { data: captureRows },
    messages,
  ] = await Promise.all([
    getPursuit(supabase, id),
    getPursuitCaptures(supabase, id),
    getPursuitConversation(supabase, id).catch(() => [] as PursuitConversation[]),
  ])

  if (error || !pursuit) notFound()

  const captures = (captureRows ?? [])
    .map((row) => {
      const raw = row.captures
      return (Array.isArray(raw) ? raw[0] : raw) as unknown as CaptureWithEnrichment | undefined
    })
    .filter((c): c is CaptureWithEnrichment => Boolean(c))

  return (
    <PursuitDetailClient
      pursuit={pursuit as Pursuit}
      captures={captures}
      messages={messages}
    />
  )
}
