-- Replace the flat `genres` array with a single general `category`
-- plus a list of `subcategories` under it.
--
-- `genres` is intentionally left in place (dormant) so an older deploy
-- still mid-rollout doesn't break. Once everything's confirmed working
-- you can drop it:  alter table books drop column genres;

alter table books
  add column if not exists category text,
  add column if not exists subcategories text[] not null default '{}';

-- Carry any existing genre values across into subcategories so nothing
-- is lost (only where subcategories hasn't been set yet).
update books
set subcategories = genres
where coalesce(array_length(genres, 1), 0) > 0
  and coalesce(array_length(subcategories, 1), 0) = 0;

notify pgrst, 'reload schema';
