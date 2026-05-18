import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useBooks } from '../queries/books.ts'
import { Cover } from '../components/Cover.tsx'

export function Bookcase() {
  const { data: books, isPending, error } = useBooks()

  return (
    <>
      <title>Shelved</title>
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Your Bookcase</h1>
        {books && books.length > 0 && (
          <p className="text-sm text-stone-500">
            {books.length} {books.length === 1 ? 'book' : 'books'}
          </p>
        )}
      </header>

      {isPending && <p className="text-sm text-stone-500">Loading…</p>}

      {error && (
        <p className="text-sm text-red-600">
          Failed to load: {error.message}
        </p>
      )}

      {books && books.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-stone-500 mb-4">
            Your shelf is empty.
          </p>
          <Link
            to="/add"
            className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-sm text-white"
          >
            <Plus className="h-4 w-4" />
            Add your first book
          </Link>
        </div>
      )}

      {books && books.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-5">
          {books.map((book) => (
            <li key={book.id}>
              <Link
                to={`/book/${book.id}`}
                className="block group"
                aria-label={book.title}
              >
                <Cover
                  path={book.cover_path}
                  title={book.title}
                  className="aspect-[2/3] w-full shadow-sm group-hover:shadow-md transition-shadow"
                />
                <div className="mt-1.5">
                  <h3 className="text-xs font-medium leading-tight line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-xs text-stone-500 truncate">
                    {book.authors.join(', ') || 'Unknown author'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
