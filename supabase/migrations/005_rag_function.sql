-- Migration 005: match_captures — Postgres function for RAG retrieval
--
-- Used by the chat-with-ki Edge Function. Embeds the user's question,
-- then returns the top N captures ranked by: starred first → cosine
-- similarity → recency as tiebreaker (ORDER BY captured_at in a future pass).
--
-- Called via supabase.rpc('match_captures', { ... })

CREATE OR REPLACE FUNCTION match_captures(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int DEFAULT 10
)
RETURNS TABLE (
  id           uuid,
  body         text,
  title        text,
  captured_at  timestamptz,
  type         text,
  is_starred   boolean,
  similarity   float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.body,
    c.title,
    c.captured_at,
    c.type,
    c.is_starred,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM captures c
  JOIN enrichments e ON e.capture_id = c.id
  WHERE
    c.user_id           = match_user_id
    AND c.status        = 'active'
    AND c.parent_id     IS NULL           -- skip document chunks
    AND e.enrichment_status = 'complete'
    AND e.embedding     IS NOT NULL
  ORDER BY
    c.is_starred DESC,                    -- starred captures surface first
    e.embedding <=> query_embedding ASC,  -- then semantic similarity
    c.captured_at DESC                    -- recency as tiebreaker
  LIMIT match_count;
END;
$$;
