-- Per-edition started_at / finished_at dates.
--
-- User opted out of the reading_sessions table for tracking progress
-- but does want "when did I read this edition" as a single pair of
-- nullable dates directly on the edition row. Simpler model: one date
-- per state, no history of re-reads.

alter table editions
  add column if not exists started_at date,
  add column if not exists finished_at date;

notify pgrst, 'reload schema';
