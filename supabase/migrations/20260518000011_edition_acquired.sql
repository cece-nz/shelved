-- How each edition was acquired: 'library' (default) or 'purchased'.
alter table editions
  add column if not exists acquired text not null default 'library'
  check (acquired in ('library', 'purchased'));

-- ── Backfill existing rows ────────────────────────────────────────────────
-- 1) Anything with a store, a price, or a purchase date = purchased.
update editions
set acquired = 'purchased'
where store_id is not null
   or purchase_price is not null
   or purchase_date is not null;

-- 2) Libby / Borrowbox are library loans, not purchases — mark them library
--    and clear the purchase fields. Adjust the matching below if you stored
--    them differently (e.g. a different store name or free-text location).
update editions e
set acquired = 'library',
    store_id = null,
    purchase_date = null,
    purchase_price = null,
    purchase_location = null,
    is_preorder = false
where e.store_id in (
        select id from stores where name ilike 'libby' or name ilike 'borrowbox'
      )
   or e.purchase_location ilike '%libby%'
   or e.purchase_location ilike '%borrowbox%';

notify pgrst, 'reload schema';
