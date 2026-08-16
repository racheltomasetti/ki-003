-- Migration 021: match_pursuit_captures — pursuit-scoped RAG retrieval
--
-- pursuit-agent previously loaded every capture ever linked to a pursuit,
-- full enrichment text, uncapped, on every single message — real token
-- cost growth as a pursuit matures, and eventually a context-window risk.
-- This mirrors match_captures (005_rag_function.sql / 019_...) — same
-- HNSW-indexed similarity ranking, same starred-first tiebreak — scoped
-- additionally to a single pursuit via capture_pursuits.

create or replace function match_pursuit_captures(
  query_embedding   vector(1536),
  match_pursuit_id  uuid,
  match_user_id     uuid,
  match_count       int default 11
)
returns table (
  id                uuid,
  body              text,
  title             text,
  captured_at       timestamptz,
  is_starred        boolean,
  similarity        float,
  cycle_day         int,
  summary           text,
  themes            text[],
  questions_raised  text[]
)
language plpgsql
security definer
as $$
begin
  return query
  select
    c.id,
    c.body,
    c.title,
    c.captured_at,
    c.is_starred,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.cycle_day,
    e.summary,
    e.themes,
    e.questions_raised
  from captures c
  join enrichments e on e.capture_id = c.id
  join capture_pursuits cp on cp.capture_id = c.id
  where
    cp.pursuit_id       = match_pursuit_id
    and c.user_id        = match_user_id
    and c.status          = 'active'
    and c.parent_id       is null           -- skip document chunks
    and e.enrichment_status = 'complete'
    and e.embedding        is not null
  order by
    c.is_starred desc,                      -- starred captures surface first
    e.embedding <=> query_embedding asc,    -- then semantic similarity
    c.captured_at desc                      -- recency as tiebreaker
  limit match_count;
end;
$$;
