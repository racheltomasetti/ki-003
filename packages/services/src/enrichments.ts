// Ki — enrichments service
//
// READ ONLY. The app never writes enrichments.
// All writes happen via the enrich-capture Edge Function triggered by Postgres webhook.

import type { SupabaseClient } from '@supabase/supabase-js'

export async function getEnrichment(client: SupabaseClient, captureId: string) {
  return client
    .from('enrichments')
    .select('*')
    .eq('capture_id', captureId)
    .single()
}

export async function getEnrichmentStatus(client: SupabaseClient, captureId: string) {
  return client
    .from('enrichments')
    .select('enrichment_status, processed_at')
    .eq('capture_id', captureId)
    .single()
}
