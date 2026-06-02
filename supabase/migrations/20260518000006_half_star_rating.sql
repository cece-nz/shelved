-- Allow half-star ratings: change books.rating from int to numeric(2,1).
--
-- Old constraint required an integer 1-5. New constraint allows 0.5
-- increments between 0 and 5 (existing integer ratings cast cleanly).

alter table books drop constraint if exists books_rating_check;

alter table books
  alter column rating type numeric(2, 1) using rating::numeric(2, 1);

alter table books add constraint books_rating_check
  check (rating is null or (rating >= 0 and rating <= 5));
