-- Migration 014: clean up legacy pursuit brief fields
--
-- Drops the old project-brief columns that are no longer part of the pursuit
-- creation flow (why, success_looks_like, open_question) and drops `what`,
-- which is consolidated into the existing `description` column.
-- The new creation flow writes to: name, description, core_question, pursuit_mode.

ALTER TABLE public.pursuits
  DROP COLUMN IF EXISTS why,
  DROP COLUMN IF EXISTS success_looks_like,
  DROP COLUMN IF EXISTS open_question,
  DROP COLUMN IF EXISTS what;

-- After running: supabase gen types typescript --linked > packages/types/src/database.ts
