-- Add an "unknown / not set" acquisition state so a book is never labelled
-- Library just because it has no purchase info.
alter table editions drop constraint if exists editions_acquired_check;
alter table editions
  alter column acquired set default 'unknown',
  add constraint editions_acquired_check
    check (acquired in ('library', 'purchased', 'unknown'));

-- Recompute every row from its own evidence (safe to re-run):
--   • Libby / Borrowbox (by store name or location text) -> library
--   • otherwise has a store / price / date               -> purchased
--   • everything else                                    -> not set (unknown)
update editions e set acquired = case
  when e.store_id in (select id from stores where name ~* 'libby|borrowbox')
       or coalesce(e.purchase_location, '') ~* 'libby|borrowbox'
       then 'library'
  when e.store_id is not null
       or e.purchase_price is not null
       or e.purchase_date is not null
       then 'purchased'
  else 'unknown'
end;

notify pgrst, 'reload schema';
