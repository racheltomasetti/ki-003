// Ki — transcribe Edge Function
//
// Server-side Whisper transcription. The OpenAI key never leaves the server —
// clients send audio here with their session JWT, and only authenticated
// users can transcribe.
//
// Request:  multipart/form-data with a `file` field (webm from web, m4a from mobile)
// Response: { text: string }

import { createClient } from 'npm:@supabase/supabase-js@2'

const WHISPER_MODEL = 'whisper-1'
const LANGUAGE = 'en'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  // Verify the user's JWT by passing the token directly to getUser()
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS })
  }
  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS })
  }

  let file: File | null = null
  try {
    const form = await req.formData()
    const entry = form.get('file')
    if (entry instanceof File) file = entry
  } catch {
    // fall through to the 400 below
  }
  if (!file || file.size === 0) {
    return new Response(JSON.stringify({ error: 'Missing audio file' }), { status: 400, headers: JSON_HEADERS })
  }

  const whisperForm = new FormData()
  whisperForm.append('file', file, file.name || 'recording')
  whisperForm.append('model', WHISPER_MODEL)
  whisperForm.append('language', LANGUAGE)

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    body: whisperForm,
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error(`Whisper error ${res.status}: ${detail}`)
    return new Response(JSON.stringify({ error: 'Transcription failed' }), { status: 502, headers: JSON_HEADERS })
  }

  const data = await res.json()
  return new Response(JSON.stringify({ text: data.text as string }), { status: 200, headers: JSON_HEADERS })
})
