import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useBook } from '../queries/books.ts'
import { Cover } from '../components/Cover.tsx'

export function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: book, isPending, error } = useBook(id)

  return (
    <>
      <title>{book ? `${book.title} · Shelved` : 'Book · Shelved'}</title>

      <header className="mb-4 flex items-center gap-2">
        <Link
          to="/"
          aria-label="Back to bookcase"
          className="p-1 text-stone-500 hover:text-stone-800"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold truncate">
          {book?.title ?? 'Book'}
        </h1>
      </header>

      {isPending && <p className="text-sm text-stone-500">Loading…</p>}
      {error && (
        <p className="text-sm text-red-600">
          Failed to load: {error.message}
        </p>
      )}

      {book && (
        <div className="flex gap-4">
          <Cover
            path={book.cover_path}
            title={book.title}
            className="w-28 h-40 shrink-0"
          />
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-stone-700">
              {book.authors.length > 0
                ? book.authors.join(', ')
                : 'Unknown author'}
            </p>
            {(book.publisher || book.published_year) && (
              <p className="text-xs text-stone-500">
                {[book.publisher, book.published_year]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {book.genres.length > 0 && (
              <p className="text-xs text-stone-500">
                {book.genres.slice(0, 4).join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}

      {book?.description && (
        <p className="mt-4 text-sm text-stone-700 leading-relaxed whitespace-pre-line">
          {book.description}
        </p>
      )}

      <p className="mt-8 text-xs text-stone-400">
        Coming next: editions, notes, quotes, bookmarks, reading sessions.
      </p>
    </>
  )
}

