-- Migration 013: rename project_mode → pursuit_mode on pursuits table
--
-- Migration 012 renamed the projects table to pursuits but missed this column.

ALTER TABLE public.pursuits DROP CONSTRAINT IF EXISTS projects_project_mode_check;

ALTER TABLE public.pursuits RENAME COLUMN project_mode TO pursuit_mode;

ALTER TABLE public.pursuits
  ADD CONSTRAINT pursuits_pursuit_mode_check
  CHECK (pursuit_mode IN ('building', 'researching', 'figuring_out', 'creating'));
