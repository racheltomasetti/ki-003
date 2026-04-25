-- Ki — project brief
--
-- Adds a Ki-generated brief to each project.
-- The brief is a structured markdown document synthesized from the project's
-- captures. It serves as portable context — paste it into any LLM to bring
-- it up to speed on exactly where your thinking is on this project.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS brief             text,
  ADD COLUMN IF NOT EXISTS brief_generated_at timestamptz;
