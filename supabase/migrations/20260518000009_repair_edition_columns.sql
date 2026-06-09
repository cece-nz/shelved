-- Idempotent repair for projects created from the Phase 1 initial_schema
-- before started_at / finished_at / is_trophy / cover_path lived on editions.
-- Safe to re-run; no-op when columns already exist.

alter table editions
  add column if not exists cover_path text,
  add column if not exists started_at date,
  add column if not exists finished_at date,
  add column if not exists is_trophy boolean not null default false;

notify pgrst, 'reload schema';
