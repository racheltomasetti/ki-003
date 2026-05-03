-- Migration 011: project status (active / archived)
--
-- Projects can be archived to free up the 3-project active limit
-- without losing the project and its captures.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'archived'));

-- Composite index — all project queries filter by user_id + status
CREATE INDEX IF NOT EXISTS idx_projects_user_id_status ON projects(user_id, status);
