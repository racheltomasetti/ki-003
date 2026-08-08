-- Migration 019: match_captures — surface cycle_day per retrieved capture
--
-- Phase C (docs/active/cycle-tracker.md) needs chat-with-ki's RAG layer to
-- know each retrieved capture's stamped cycle_day, so Ki can correlate what
-- was captured against where the user was in their cycle ("you've captured
-- this doubt three times — always late luteal"). The phase itself is still
-- derived at read time in the edge function, never stored — this migration
-- only widens the return shape to pass the stamped day through.

drop function if exists match_captures(vector(1536), uuid, int);

create or replace function match_captures(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int default 10
)
returns table (
  id                uuid,
  body              text,
  title             text,
  captured_at       timestamptz,
  type              text,
  is_starred        boolean,
  similarity        float,
  cycle_day         int,
  cycle_start_date  date
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
    c.type,
    c.is_starred,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.cycle_day,
    e.cycle_start_date
  from captures c
  join enrichments e on e.capture_id = c.id
  where
    c.user_id           = match_user_id
    and c.status         = 'active'
    and c.parent_id      is null           -- skip document chunks
    and e.enrichment_status = 'complete'
    and e.embedding       is not null
  order by
    c.is_starred desc,                     -- starred captures surface first
    e.embedding <=> query_embedding asc,   -- then semantic similarity
    c.captured_at desc                     -- recency as tiebreaker
  limit match_count;
end;
$$;
