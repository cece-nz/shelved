-- Book-level reading status, replacing the per-edition trophy / date UI.
--
-- One of: 'want_to_read' | 'reading' | 'read' | null.
-- Backfill from existing data so users don't lose state:
--   * any edition finished or trophy → 'read'
--   * else any edition started but not finished → 'reading'
--   * else book on TBR list → 'want_to_read'

alter table books
  add column if not exists reading_status text;

alter table books drop constraint if exists books_reading_status_check;

alter table books add constraint books_reading_status_check
  check (reading_status is null or reading_status in ('want_to_read', 'reading', 'read'));

update books set reading_status = 'want_to_read'
where id in (
  select book_id from list_items where list_kind in ('tbr_top', 'tbr_pool')
);

update books set reading_status = 'reading'
where id in (
  select distinct book_id from editions
  where started_at is not null and finished_at is null
);

update books set reading_status = 'read'
where id in (
  select distinct book_id from editions
  where finished_at is not null or is_trophy = true
);

notify pgrst, 'reload schema';
