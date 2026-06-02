-- Series fields on books + per-edition cover.
--
-- Series: stored as `series_name` (text) + `series_index` (numeric).
-- The numeric index makes "book #1 / #2 / #1.5" sort cleanly. Optional,
-- so standalone books stay null.
--
-- Per-edition covers: `editions.cover_path` lets you override the
-- book-level cover for a specific printing (special edition, audiobook,
-- etc.). When null the app falls back to the book's cover_path, and
-- then to a stylized title placeholder.

alter table books
  add column series_name text,
  add column series_index numeric(5, 2);

create index books_user_series_idx
  on books (user_id, series_name, series_index)
  where series_name is not null;

alter table editions
  add column cover_path text;
