import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useTbrBooks, type TbrEntry } from '../queries/lists.ts'
import { BookCard } from '../components/BookCard.tsx'

export function TBR() {
  const { data, isPending, error } = useTbrBooks()

  return (
    <>
      <title>TBR · Shelved</title>
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">To Be Read</h1>
        <p className="text-sm text-slate-500">
          Your top 10 — and the pool of everything else queued up.
        </p>
      </header>

      {isPending && <p className="text-sm text-slate-500">Loading…</p>}

      {error && (
        <p className="text-sm text-rose-600">
          Failed to load: {error.message}
        </p>
      )}

      {data && data.top.length === 0 && data.pool.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-slate-500 mb-4">Your TBR is empty.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm underline"
          >
            <Plus className="h-4 w-4" />
            Add books to TBR from the book detail page
          </Link>
        </div>
      )}

      {data && (
        <>
          {data.top.length > 0 && (
            <TbrSection
              title={`Top (${data.top.length}/10)`}
              entries={data.top}
              showRank
            />
          )}

          {data.pool.length > 0 && (
            <TbrSection
              title={`Pool (${data.pool.length})`}
              entries={data.pool}
            />
          )}
        </>
      )}
    </>
  )
}

function TbrSection({
  title,
  entries,
  showRank,
}: {
  title: string
  entries: TbrEntry[]
  showRank?: boolean
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-medium text-slate-700 mb-2">{title}</h2>
      <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-5">
        {entries.map((entry, idx) => (
          <li key={entry.item.id}>
            <BookCard
              book={entry.book}
              rank={showRank ? idx + 1 : undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
