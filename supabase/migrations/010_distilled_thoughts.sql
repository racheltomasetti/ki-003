-- Ki — migration 010: distilled thoughts
--
-- The output of the thought distiller is a capture, not a separate table.
-- source_type = 'distilled' identifies it in the corpus.
-- The output history is a filtered view of captures — no dedicated table needed.
--
-- Also removes ki_sections (replaced by this model) and the one-shot
-- brief columns on projects (replaced by the conversational thought distiller).

-- ─── Remove ki_sections ───────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.ki_sections CASCADE;

-- ─── Remove projects.ki columns ──────────────────────────────────────────────
-- Context fields (what, why, success_looks_like, open_question, project_mode)
-- remain from 009 and are not touched.

ALTER TABLE public.projects
  DROP COLUMN IF EXISTS ki,
  DROP COLUMN IF EXISTS ki_updated_at;

-- ─── Extend captures: source_type ────────────────────────────────────────────
-- 'distilled' = produced by the Ki thought distiller from existing corpus captures.
-- These are second-layer thinking: already synthesized, still enrichable.

ALTER TABLE public.captures
  DROP CONSTRAINT captures_source_type_check;

ALTER TABLE public.captures
  ADD CONSTRAINT captures_source_type_check
    CHECK (source_type IN ('voice', 'text', 'file', 'oura', 'apple_health', 'manual', 'distilled'));

-- ─── Extend captures: enrichment_profile ─────────────────────────────────────
-- 'distilled' profile: skips mood_tags, energy_level, sentiment.
-- Extracts themes, summary, questions_raised, key_quotes from synthesized content.
-- referenced_capture_ids stored in source_metadata jsonb at write time.

ALTER TABLE public.captures
  DROP CONSTRAINT captures_enrichment_profile_check;

ALTER TABLE public.captures
  ADD CONSTRAINT captures_enrichment_profile_check
    CHECK (enrichment_profile IN ('personal', 'artifact', 'distilled'));
