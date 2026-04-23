-- Migration 006: projects + capture_projects
--
-- Projects are named collections that captures belong to.
-- A capture can live in multiple projects.
-- Tags remain cross-cutting freeform labels — they work inside and across projects.

-- ─── projects ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  color       text,    -- hex string e.g. '#58a4b0' — chosen by user or auto-assigned
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

CREATE TRIGGER handle_updated_at_projects
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id);

-- ─── capture_projects ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capture_projects (
  capture_id  uuid NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (capture_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_capture_projects_project_id ON capture_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_capture_projects_capture_id ON capture_projects(capture_id);
CREATE INDEX IF NOT EXISTS idx_capture_projects_user_id    ON capture_projects(user_id);

ALTER TABLE capture_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own capture_projects"
  ON capture_projects FOR ALL
  USING (auth.uid() = user_id);
