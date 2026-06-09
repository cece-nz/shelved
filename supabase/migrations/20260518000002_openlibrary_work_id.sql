-- Open Library Work ID on books.
--
-- Every Open Library ISBN lookup returns a /works/OL...W key — different
-- printings of the same novel share it (paperback + hardcover + audiobook
-- of "Pride and Prejudice" all = OL66554W). Storing it lets us group
-- editions under one book row without writing fuzzy title/author matching.
--
-- No UNIQUE constraint: we want the user to be able to opt into creating
-- a "separate book" entry for the same work (intentional duplicate). The
-- dedup default lives in app code; the database stays permissive.

alter table books add column if not exists openlibrary_work_id text;

-- Partial index: only books that have a work ID are useful to look up
-- by it. Saves space and write overhead on manually-added books with no
-- OL identity.
create index books_user_workid_idx
  on books (user_id, openlibrary_work_id)
  where openlibrary_work_id is not null;
