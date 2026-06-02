import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useBooks } from '../queries/books.ts'
import { BookCard } from '../components/BookCard.tsx'

export function SeriesPage() {
  const { name } = useParams<{ name: string }>()
  const decoded = decodeURIComponent(name ?? '')
  const { data: books = [], isPending, error } = useBooks()

  const filtered = useMemo(
    () =>
      books
        .filter((b) => b.series_name === decoded)
        .sort((a, b) => {
          const ai = a.series_index ?? Number.MAX_SAFE_INTEGER
          const bi = b.series_index ?? Number.MAX_SAFE_INTEGER
          if (ai !== bi) return ai - bi
          return a.title.localeCompare(b.title)
        }),
    [books, decoded],
  )

  return (
    <>
      <title>{decoded} · Shelved</title>
      <header className="mb-4 flex items-center gap-2">
        <Link
          to="/"
          aria-label="Back to bookcase"
          className="p-1 text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold truncate">{decoded}</h1>
          {!isPending && (
            <p className="text-sm text-slate-500">
              {filtered.length} {filtered.length === 1 ? 'book' : 'books'} in this series
            </p>
          )}
        </div>
      </header>

      {isPending && <p className="text-sm text-slate-500">Loading…</p>}
      {error && (
        <p className="text-sm text-rose-600">Failed to load: {error.message}</p>
      )}

      {!isPending && filtered.length === 0 && (
        <p className="text-sm text-slate-500">
          No books in "{decoded}" yet.
        </p>
      )}

      {filtered.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-6">
          {filtered.map((book) => (
            <li key={book.id}>
              <BookCard
                book={book}
                rank={book.series_index ?? undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
