-- Shelved: initial schema
--
-- Single-user app, but every "owned" row still carries user_id and is
-- protected by Row-Level Security so data can never leak across accounts
-- (and adding a second user later costs nothing).

-- ============================================================
-- Helper: auto-update `updated_at` on row UPDATE
-- ============================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- books — the "work" (one row per distinct title)
-- ============================================================

create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  authors text[] not null default '{}',
  publisher text,
  published_year int,
  description text,
  genres text[] not null default '{}',
  tags text[] not null default '{}',
  cover_path text,
  rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5)),
  openlibrary_work_id text,
  series_name text,
  series_index numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index books_user_id_idx on books (user_id);
create index books_authors_gin on books using gin (authors);
create index books_genres_gin on books using gin (genres);
create index books_tags_gin on books using gin (tags);
create index books_user_workid_idx
  on books (user_id, openlibrary_work_id)
  where openlibrary_work_id is not null;
create index books_user_series_idx
  on books (user_id, series_name, series_index)
  where series_name is not null;

create trigger books_updated_at
  before update on books
  for each row execute function set_updated_at();

-- ============================================================
-- editions — owned copies of a book
-- ============================================================

create table editions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  format text not null check (format in (
    'paperback','hardcover','ebook','audiobook','special_edition','other'
  )),
  isbn text,
  publisher text,
  publication_date date,
  page_count int,
  duration_seconds int,
  purchase_date date,
  purchase_location text,
  purchase_price numeric(10,2),
  currency text default 'AUD',
  condition text check (condition in ('new','second_hand','unknown')),
  notes text,
  cover_path text,
  started_at date,
  finished_at date,
  is_trophy boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index editions_book_id_idx on editions (book_id);
create index editions_user_id_idx on editions (user_id);
create index editions_isbn_idx on editions (isbn) where isbn is not null;

create trigger editions_updated_at
  before update on editions
  for each row execute function set_updated_at();

-- ============================================================
-- reading_sessions — when you started/finished an edition
-- ============================================================

create table reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  edition_id uuid not null references editions(id) on delete cascade,
  started_at date,
  finished_at date,
  created_at timestamptz not null default now()
);

create index reading_sessions_edition_idx on reading_sessions (edition_id);
create index reading_sessions_finished_idx
  on reading_sessions (finished_at desc nulls last);

-- ============================================================
-- notes — free-form thoughts on a book (work-level)
-- ============================================================

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_book_id_idx on notes (book_id);

create trigger notes_updated_at
  before update on notes
  for each row execute function set_updated_at();

-- ============================================================
-- quotes — pull-quotes with optional character + location
-- ============================================================

create table quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  body text not null,
  character text,
  location text,
  created_at timestamptz not null default now()
);

create index quotes_book_id_idx on quotes (book_id);

-- ============================================================
-- bookmarks — quick note tied to a location
-- ============================================================

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  note text,
  location text,
  created_at timestamptz not null default now()
);

create index bookmarks_book_id_idx on bookmarks (book_id);

-- ============================================================
-- list_items — TBR top, TBR pool, wishlist
-- ============================================================

create table list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  list_kind text not null check (list_kind in ('tbr_top','tbr_pool','wishlist')),
  position int,
  created_at timestamptz not null default now(),

  unique (user_id, book_id, list_kind)
);

create index list_items_user_kind_idx
  on list_items (user_id, list_kind, position);

-- ============================================================
-- Grants
-- Postgres enforces table-level privileges in front of RLS, so the
-- `authenticated` role needs SELECT/INSERT/UPDATE/DELETE before any
-- of the policies below can do their job.
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  books, editions, reading_sessions, notes, quotes, bookmarks, list_items
to authenticated;

grant usage on all sequences in schema public to authenticated;

-- ============================================================
-- Row-Level Security
-- One "owner" policy per table covers SELECT/INSERT/UPDATE/DELETE.
-- ============================================================

alter table books            enable row level security;
alter table editions         enable row level security;
alter table reading_sessions enable row level security;
alter table notes            enable row level security;
alter table quotes           enable row level security;
alter table bookmarks        enable row level security;
alter table list_items       enable row level security;

create policy "owner_all" on books
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_all" on editions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_all" on reading_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_all" on notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_all" on quotes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_all" on bookmarks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner_all" on list_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- Storage: covers bucket (public read, owner write)
-- ============================================================

insert into storage.buckets (id, name, public)
  values ('covers', 'covers', true)
  on conflict (id) do nothing;

create policy "covers_public_read"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "covers_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'covers' and auth.uid() = owner);

create policy "covers_owner_update"
  on storage.objects for update
  using (bucket_id = 'covers' and auth.uid() = owner);

create policy "covers_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'covers' and auth.uid() = owner);
