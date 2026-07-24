-- Ki — todos
--
-- Todos are the thinking-to-action layer. They can stand alone or serve an
-- active pursuit, and may be created manually or proposed by Ki.

CREATE TABLE IF NOT EXISTS public.todos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pursuit_id  uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  title       text NOT NULL CHECK (length(btrim(title)) > 0),
  notes       text,
  status      text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'complete', 'archived')),
  priority    text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  due_date    date,
  source      text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'agent')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS todos_user_status_idx
  ON public.todos(user_id, status);

CREATE INDEX IF NOT EXISTS todos_user_priority_idx
  ON public.todos(user_id, priority);

CREATE INDEX IF NOT EXISTS todos_user_due_date_idx
  ON public.todos(user_id, due_date);

CREATE INDEX IF NOT EXISTS todos_pursuit_id_idx
  ON public.todos(pursuit_id);

-- A todo may only connect to a pursuit owned by the same user. The pursuit can
-- later be archived without breaking the historical connection.
CREATE OR REPLACE FUNCTION public.validate_todo_pursuit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.pursuit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.pursuits
    WHERE id = NEW.pursuit_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Todo pursuit must belong to the todo owner';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER todos_validate_pursuit
  BEFORE INSERT OR UPDATE OF pursuit_id, user_id ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.validate_todo_pursuit();

CREATE TRIGGER todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own todos"
  ON public.todos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
