import { Link } from 'react-router-dom'
import { Cover } from './Cover.tsx'
import type { BookRow } from '../lib/database.types.ts'

/**
 * Reusable "cover card" used by the bookcase, TBR list, and (soon)
 * wishlist. Same visual treatment everywhere — covers do the talking.
 *
 * Optional props for context-specific overlays:
 *   - `rank` (number) — top-left numeric badge, used by TBR top
 *   - `editionCount` (number) — bottom-right "×N" badge when >1, used
 *     by the bookcase to flag books you own in multiple formats
 */
export function BookCard({
  book,
  rank,
  editionCount,
}: {
  book: BookRow
  rank?: number
  editionCount?: number
}) {
  const showEditionBadge = editionCount != null && editionCount > 1

  return (
    <Link
      to={`/book/${book.id}`}
      className="block group"
      aria-label={book.title}
    >
      <div className="relative">
        <Cover
          path={book.cover_path}
          title={book.title}
          authors={book.authors}
          version={book.updated_at}
          className="aspect-[2/3] w-full rounded-lg shadow-sm group-hover:shadow-md transition-shadow"
        />
        {rank != null && (
          <span className="absolute -top-1.5 -left-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white text-xs font-semibold shadow">
            {rank}
          </span>
        )}
        {showEditionBadge && (
          <span
            className="absolute bottom-1 right-1 inline-flex items-center px-2 py-0.5 rounded-full bg-teal-500 text-white text-[10px] font-semibold shadow"
            aria-label={`${editionCount} editions`}
            title={`${editionCount} editions`}
          >
            ×{editionCount}
          </span>
        )}
      </div>
      <div className="mt-1.5">
        <h3 className="text-xs font-medium leading-tight line-clamp-2">
          {book.title}
        </h3>
        <p className="text-xs text-slate-500 truncate">
          {book.authors.join(', ') || 'Unknown author'}
        </p>
      </div>
    </Link>
  )
}
