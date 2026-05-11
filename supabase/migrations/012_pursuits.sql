-- Migration 012: projects → pursuits
--
-- Renames the projects table and all related tables to reflect the
-- "pursuit" entity model. Adds status='curiosity', core_question,
-- core_question_embedding, and pursuit_connections on enrichments.
-- See docs/PURSUIT_MODEL.md for full spec.

-- ─── 1. Rename tables ─────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.projects              RENAME TO pursuits;
ALTER TABLE IF EXISTS public.capture_projects      RENAME TO capture_pursuits;
ALTER TABLE IF EXISTS public.project_artifacts     RENAME TO pursuit_artifacts;
ALTER TABLE IF EXISTS public.project_conversations RENAME TO pursuit_conversations;

-- ─── 2. Rename columns in junction / child tables ─────────────────────────────

ALTER TABLE IF EXISTS public.capture_pursuits
  RENAME COLUMN project_id TO pursuit_id;

ALTER TABLE IF EXISTS public.pursuit_artifacts
  RENAME COLUMN project_id TO pursuit_id;

ALTER TABLE IF EXISTS public.pursuit_conversations
  RENAME COLUMN project_id TO pursuit_id;

-- ─── 3. Update status CHECK constraint to include 'curiosity' ─────────────────
-- Migration 011 added status with CHECK (active|archived). Drop the old
-- auto-named constraint and recreate including 'curiosity'.

ALTER TABLE public.pursuits DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.pursuits DROP CONSTRAINT IF EXISTS pursuits_status_check;

ALTER TABLE public.pursuits
  ADD CONSTRAINT pursuits_status_check
  CHECK (status IN ('active', 'curiosity', 'archived'));

-- ─── 4. Add pursuit-specific columns ──────────────────────────────────────────

ALTER TABLE public.pursuits
  ADD COLUMN IF NOT EXISTS core_question           text,
  ADD COLUMN IF NOT EXISTS core_question_embedding vector(1536);

-- ─── 5. Add pursuit_connections to enrichments ────────────────────────────────
-- Shape: [{pursuit_id, reason, confidence, matched_at}]
-- Written by enrich-capture and match-corpus-to-pursuit Edge Functions only.

ALTER TABLE public.enrichments
  ADD COLUMN IF NOT EXISTS pursuit_connections jsonb;

-- ─── 6. Rename indexes ────────────────────────────────────────────────────────

ALTER INDEX IF EXISTS idx_projects_user_id_status
  RENAME TO idx_pursuits_user_id_status;

-- ─── 7. Add index for capture_pursuits (if not already present) ───────────────

CREATE INDEX IF NOT EXISTS idx_capture_pursuits_pursuit_id
  ON public.capture_pursuits (pursuit_id);

-- ─── 8. Add index for core_question_embedding (IVFFlat for pgvector) ──────────
-- Only useful once rows have embeddings — safe to add now.

CREATE INDEX IF NOT EXISTS idx_pursuits_core_question_embedding
  ON public.pursuits
  USING ivfflat (core_question_embedding vector_cosine_ops)
  WITH (lists = 10);

-- ─── 9. Update conversation role values: user→hero, assistant→ki ─────────────
-- Roles renamed to match Ki's product language.
-- hero = the person. ki = the AI thinking partner.
-- Edge functions map hero→user and ki→assistant before calling Anthropic API.

ALTER TABLE public.pursuit_conversations
  DROP CONSTRAINT IF EXISTS project_conversations_role_check,
  DROP CONSTRAINT IF EXISTS pursuit_conversations_role_check;

UPDATE public.pursuit_conversations SET role = 'hero' WHERE role = 'user';
UPDATE public.pursuit_conversations SET role = 'ki'   WHERE role = 'assistant';

ALTER TABLE public.pursuit_conversations
  ADD CONSTRAINT pursuit_conversations_role_check
  CHECK (role IN ('hero', 'ki'));

-- ─── Notes ────────────────────────────────────────────────────────────────────
-- Canvas tables (canvas_nodes, canvas_edges, canvas_conversations) still have
-- a project_id column referencing the renamed pursuits(id). The FK reference
-- updates automatically with the table rename. Canvas is a parked surface —
-- column renames there will follow when canvas is re-activated.
--
-- After running: supabase gen types typescript --linked > packages/types/src/database.ts
