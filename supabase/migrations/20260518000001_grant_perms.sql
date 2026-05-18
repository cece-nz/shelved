-- Grant table-level privileges to the `authenticated` role.
--
-- RLS gates which ROWS a query can touch, but Postgres also enforces
-- privileges at the TABLE level — without these grants you get
-- "permission denied for table books" before RLS even gets a look-in.
-- (Supabase used to auto-grant via default privileges on the public
-- schema; recent project setups don't always, hence this explicit
-- migration.)

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  books,
  editions,
  reading_sessions,
  notes,
  quotes,
  bookmarks,
  list_items
to authenticated;

-- Safety net for any future tables that use serial/identity columns.
grant usage on all sequences in schema public to authenticated;
