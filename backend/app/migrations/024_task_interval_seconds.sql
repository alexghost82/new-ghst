-- Switch interval scheduling from minutes to seconds so a task can run as
-- often as every 45 seconds. The browser task engine ticks every 20s and
-- drains runs serially, so sub-minute intervals are honoured safely.
--
-- Existing interval tasks were stored in minutes; multiply by 60 to preserve
-- their effective cadence. next_run_at rows already point at a future slot and
-- are left untouched — the next claim recomputes them from interval_seconds.

ALTER TABLE scheduled_tasks RENAME COLUMN interval_minutes TO interval_seconds;

UPDATE scheduled_tasks
   SET interval_seconds = interval_seconds * 60
 WHERE interval_seconds IS NOT NULL;
