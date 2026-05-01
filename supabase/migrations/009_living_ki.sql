-- Ki — living Ki document
--
-- Renames brief→ki on projects, adds project context fields,
-- and creates ki_sections, project_conversations, project_artifacts.

-- ─── projects ────────────────────────────────────────────────────────────────

ALTER TABLE public.projects RENAME COLUMN brief TO ki;
ALTER TABLE public.projects RENAME COLUMN brief_generated_at TO ki_updated_at;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS what               text,
  ADD COLUMN IF NOT EXISTS why               text,
  ADD COLUMN IF NOT EXISTS success_looks_like text,
  ADD COLUMN IF NOT EXISTS open_question      text,
  ADD COLUMN IF NOT EXISTS project_mode       text
    CHECK (project_mode IN ('building', 'researching', 'figuring_out', 'creating'));

-- ─── ki_sections ─────────────────────────────────────────────────────────────
-- Sections of the living Ki document for a project.
-- draft = agent proposal (accept/reject controls shown in UI)
-- accepted = user-confirmed, rendered solid

CREATE TABLE IF NOT EXISTS public.ki_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'accepted')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ki_sections_project_id_idx ON public.ki_sections(project_id);

ALTER TABLE public.ki_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own ki_sections"
  ON public.ki_sections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ki_sections_updated_at
  BEFORE UPDATE ON public.ki_sections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── project_conversations ───────────────────────────────────────────────────
-- Persistent chat history between user and Ki for a given project.

CREATE TABLE IF NOT EXISTS public.project_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_conversations_project_id_idx ON public.project_conversations(project_id);

ALTER TABLE public.project_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own project_conversations"
  ON public.project_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── project_artifacts ───────────────────────────────────────────────────────
-- Mermaid diagrams and other generated artifacts saved alongside the Ki document.
-- type: 'mermaid' | others TBD
-- No check constraint intentionally — artifact type set is still evolving.

CREATE TABLE IF NOT EXISTS public.project_artifacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'mermaid',
  title       text NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_artifacts_project_id_idx ON public.project_artifacts(project_id);

ALTER TABLE public.project_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own project_artifacts"
  ON public.project_artifacts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER project_artifacts_updated_at
  BEFORE UPDATE ON public.project_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
