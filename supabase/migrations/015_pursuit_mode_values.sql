-- Migration 015: pursuit_mode values aligned with PursuitMode type
-- UI uses: building | exploring | becoming | figuring_out
-- Legacy DB constraint (013) still had: researching | creating

ALTER TABLE public.pursuits DROP CONSTRAINT IF EXISTS pursuits_pursuit_mode_check;

UPDATE public.pursuits SET pursuit_mode = 'exploring' WHERE pursuit_mode = 'researching';
UPDATE public.pursuits SET pursuit_mode = 'becoming'   WHERE pursuit_mode = 'creating';

ALTER TABLE public.pursuits
  ADD CONSTRAINT pursuits_pursuit_mode_check
  CHECK (
    pursuit_mode IS NULL
    OR pursuit_mode IN ('building', 'exploring', 'becoming', 'figuring_out')
  );
