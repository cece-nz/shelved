-- Stores + per-edition store FK, pre-order flag, edition display name.
--
-- `stores` is a per-user table of places you buy books from. Each
-- edition optionally links to one (store_id), so the /stores page can
-- show "what did I buy here, when, for how much".
--
-- `editions.is_preorder` flags an edition that's coming but not yet
-- in hand.
--
-- `editions.display_name` is a free-text label for the edition
-- ("UK Hardcover", "Audible — Neil Gaiman narration"), useful when
-- the user manually attaches multiple editions under one book.

create table stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stores_user_id_idx on stores (user_id);

create trigger stores_updated_at
  before update on stores
  for each row execute function set_updated_at();

alter table stores enable row level security;

grant select, insert, update, delete on stores to authenticated;

create policy "owner_all" on stores
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table editions
  add column store_id uuid references stores(id) on delete set null,
  add column is_preorder boolean not null default false,
  add column display_name text;

create index editions_store_id_idx on editions (store_id);

notify pgrst, 'reload schema';
