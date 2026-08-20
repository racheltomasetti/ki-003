-- Explicit "is a period currently ongoing" state.
--
-- period_logs stays exactly as it was: immutable, one row per bleeding day,
-- the sole source of truth for cycle_day. But it has no notion of "ongoing
-- vs ended" — that has to be inferred, and inference can't tell "still
-- bleeding, haven't logged today" apart from "ended a few days ago and
-- never said so." This column is the one piece of state that answers that,
-- same role as terra-001's cycles.end_date (nullable) + PERIOD_ENDED_DATE
-- marker, collapsed into a single field since ki-003 has no cycles table.
--
-- Not null = a period is active, started on this date. Null = no active
-- period. Set by startPeriod(), cleared by endPeriod() (packages/services/src/cycle.ts).
alter table public.profiles
  add column active_period_started_on date;
