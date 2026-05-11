import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPursuit } from '@ki/services'
import { PursuitSettingsClient } from '@/components/PursuitSettingsClient'
import type { Pursuit } from '@ki/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PursuitSettingsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: pursuit, error } = await getPursuit(supabase, id)
  if (error || !pursuit) notFound()

  return <PursuitSettingsClient pursuit={pursuit as Pursuit} />
}
