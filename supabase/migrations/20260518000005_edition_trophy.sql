-- "Trophy book" flag on editions.
--
-- A trophy edition is one you've read but don't want to log dates for —
-- a treasured book in your collection, prior reads where dates are
-- forgotten, etc. UI uses this to hide the started/finished inputs and
-- still count the book as "read" for status displays.

alter table editions
  add column is_trophy boolean not null default false;
