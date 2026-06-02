import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  X,
  BookOpen,
  CheckCircle2,
  BookMarked,
  Layers,
  Trash2,
} from 'lucide-react'
import { useBooks, useDeleteBook } from '../queries/books.ts'
import {
  useEditionSummaries,
  type EditionSummary,
} from '../queries/editions.ts'
import { useTbrTopBookIds } from '../queries/lists.ts'
import { Cover } from '../components/Cover.tsx'
import { FORMAT_META } from '../components/FormatBadge.tsx'
import type { BookRow, Format } from '../lib/database.types.ts'

type SortKey =
  | 'added'
  | 'title'
  | 'author'
  | 'group_author'
  | 'group_series'

export function Bookcase() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('added')

  const { data: books = [], isPending, error } = useBooks()
  const { data: editionSummaries = new Map<string, EditionSummary>() } =
    useEditionSummaries()
  const { data: tbrTopIds = new Set<string>() } = useTbrTopBookIds()

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const book of books) {
      for (const tag of book.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) =>
      b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1],
    )
  }, [books])

  const enterSelectWith = (id: string) => {
    setSelectMode(true)
    setSelectedIds(new Set([id]))
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelect = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const isGrouped = sort === 'group_author' || sort === 'group_series'

  const filtered = useMemo(
    () => filterAndSort(books, search, sort, activeTags),
    [books, search, sort, activeTags],
  )

  // Cluster view only in group sorts. In flat sorts, render individual cards.
  const clusters = useMemo(() => {
    if (!isGrouped) return null
    return buildClusters(filtered, sort === 'group_author' ? 'author' : 'series')
  }, [filtered, isGrouped, sort])

  const [openCluster, setOpenCluster] = useState<ClusterItem | null>(null)

  return (
    <>
      <title>Shelved</title>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Your Bookcase
        </h1>
        {books.length > 0 && (
          <p className="text-sm text-slate-500 mt-0.5">
            {books.length} {books.length === 1 ? 'book' : 'books'}
          </p>
        )}
      </header>

      {allTags.length > 0 && (
        <TagFilterRow
          tags={allTags}
          active={activeTags}
          onToggle={(tag) =>
            setActiveTags((prev) => {
              const next = new Set(prev)
              if (next.has(tag)) next.delete(tag)
              else next.add(tag)
              return next
            })
          }
          onClear={() => setActiveTags(new Set())}
        />
      )}

      {books.length > 0 && (
        <div className="mb-5 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or author"
              aria-label="Search books"
              className="w-full pl-10 pr-9 py-2.5 rounded-full border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort books"
            className="px-4 py-2.5 rounded-full border border-slate-200 bg-white text-slate-700 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            <option value="added">Recently added</option>
            <option value="title">Title (A–Z)</option>
            <option value="author">Author (A–Z)</option>
            <option value="group_author">Group by author</option>
            <option value="group_series">Group by series</option>
          </select>
        </div>
      )}

      {isPending && <p className="text-sm text-slate-500">Loading…</p>}

      {error && (
        <p className="text-sm text-rose-600">Failed to load: {error.message}</p>
      )}

      {books.length === 0 && !isPending && (
        <div className="text-center py-16 rounded-2xl bg-white shadow-sm">
          <p className="text-sm text-slate-500 mb-4">Your shelf is empty.</p>
          <Link
            to="/add"
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-500 hover:bg-teal-600 px-5 py-2.5 text-sm text-white font-medium shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add your first book
          </Link>
        </div>
      )}

      {books.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-slate-500">No books match "{search}".</p>
      )}

      {selectMode && (
        <SelectionBar
          selected={selectedIds}
          onCancel={exitSelect}
        />
      )}

      {/* Flat view (Recently added / Title / Author) — individual cards */}
      {!isGrouped && filtered.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
          {filtered.map((book) => (
            <li key={book.id}>
              <BookcaseCard
                book={book}
                summary={editionSummaries.get(book.id)}
                onTbrTop={tbrTopIds.has(book.id)}
                selectMode={selectMode}
                selected={selectedIds.has(book.id)}
                onLongPress={() => enterSelectWith(book.id)}
                onToggleSelect={() => toggleSelected(book.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Grouped view (by author / by series) — stacks with modal popout */}
      {clusters && clusters.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
          {clusters.map((item) =>
            item.kind === 'single' ? (
              <li key={item.key}>
                <BookcaseCard
                  book={item.books[0]}
                  summary={editionSummaries.get(item.books[0].id)}
                  onTbrTop={tbrTopIds.has(item.books[0].id)}
                />
              </li>
            ) : (
              <li key={item.key}>
                <ClusterStack
                  cluster={item}
                  onOpen={() => setOpenCluster(item)}
                />
              </li>
            ),
          )}
        </ul>
      )}

      <AnimatePresence>
        {openCluster && (
          <ClusterModal
            cluster={openCluster}
            editionSummaries={editionSummaries}
            tbrTopIds={tbrTopIds}
            onClose={() => setOpenCluster(null)}
          />
        )}
      </AnimatePresence>

    </>
  )
}

// ============================================================
// Clusters — series/author stacks with modal popout
// ============================================================

type ClusterItem =
  | { kind: 'single'; key: string; books: [BookRow] }
  | { kind: 'series' | 'author'; key: string; label: string; books: BookRow[] }

/**
 * Build clusters for the grouped sort modes:
 *   by === 'series'  → group books with a series_name; standalones stay
 *                     as single cards
 *   by === 'author'  → group by first author; books with no author stay
 *                     as single cards
 *
 * Clusters with 1 book collapse to a single card; clusters with 2+ render
 * as a stack with the modal popout on click.
 */
function buildClusters(books: BookRow[], by: 'author' | 'series'): ClusterItem[] {
  const map = new Map<string, BookRow[]>()
  const singles: BookRow[] = []

  for (const book of books) {
    const key =
      by === 'series'
        ? book.series_name
        : book.authors[0]?.trim() || null
    if (!key) {
      singles.push(book)
      continue
    }
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(book)
  }

  const items: ClusterItem[] = []
  for (const [name, group] of map) {
    if (group.length === 1) {
      singles.push(group[0])
      continue
    }
    items.push({
      kind: by,
      key: `${by}:${name}`,
      label: name,
      books:
        by === 'series'
          ? [...group].sort(
              (a, b) =>
                (a.series_index ?? Number.MAX_SAFE_INTEGER) -
                (b.series_index ?? Number.MAX_SAFE_INTEGER),
            )
          : [...group].sort((a, b) => a.title.localeCompare(b.title)),
    })
  }
  for (const book of singles) {
    items.push({ kind: 'single', key: `single:${book.id}`, books: [book] })
  }

  // Sort clusters alphabetically by label; singletons by their title.
  items.sort((a, b) => {
    const aLabel = a.kind === 'single' ? a.books[0].title : a.label
    const bLabel = b.kind === 'single' ? b.books[0].title : b.label
    return aLabel.localeCompare(bLabel)
  })
  return items
}

function ClusterStack({
  cluster,
  onOpen,
}: {
  cluster: Extract<ClusterItem, { kind: 'series' | 'author' }>
  onOpen: () => void
}) {
  const [front, peek1, peek2] = cluster.books

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block group text-left w-full"
      aria-label={`Open ${cluster.label} — ${cluster.books.length} books`}
    >
      <div className="relative aspect-[2/3] w-full pr-4">
        {peek2 && (
          <div className="absolute inset-y-0 right-0 w-[calc(100%-2rem)] z-0">
            <Cover
              path={peek2.cover_path}
              title={peek2.title}
              authors={peek2.authors}
              version={peek2.updated_at}
              className="w-full h-full rounded-lg shadow-sm brightness-90"
            />
          </div>
        )}
        {peek1 && (
          <div className="absolute inset-y-0 right-2 w-[calc(100%-2rem)] z-[1]">
            <Cover
              path={peek1.cover_path}
              title={peek1.title}
              authors={peek1.authors}
              version={peek1.updated_at}
              className="w-full h-full rounded-lg shadow-sm brightness-95"
            />
          </div>
        )}
        <div className="absolute inset-y-0 left-0 w-[calc(100%-1rem)] z-10">
          <Cover
            path={front.cover_path}
            title={front.title}
            authors={front.authors}
            version={front.updated_at}
            className="w-full h-full rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
          />
        </div>
        <span className="absolute -top-1.5 -right-1.5 z-20 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-semibold shadow">
          <Layers className="h-2.5 w-2.5" />
          {cluster.books.length}
        </span>
      </div>
      <div className="mt-2">
        <h3 className="text-xs font-semibold text-slate-900 leading-tight line-clamp-2">
          {cluster.label}
        </h3>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {cluster.kind === 'series' ? 'Series' : 'Author'} ·{' '}
          {cluster.books.length} books
        </p>
      </div>
    </button>
  )
}

function ClusterModal({
  cluster,
  editionSummaries,
  tbrTopIds,
  onClose,
}: {
  cluster: ClusterItem
  editionSummaries: Map<string, EditionSummary>
  tbrTopIds: Set<string>
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: 'tween', duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">
              {cluster.kind === 'single' ? cluster.books[0].title : cluster.label}
            </h2>
            <p className="text-xs text-slate-500">
              {cluster.books.length}{' '}
              {cluster.books.length === 1 ? 'book' : 'books'}
              {cluster.kind === 'series' && ' in this series'}
              {cluster.kind === 'author' && ' by this author'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {cluster.books.map((book, i) => (
            <motion.li
              key={book.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.18 }}
            >
              <BookcaseCard
                book={book}
                summary={editionSummaries.get(book.id)}
                onTbrTop={tbrTopIds.has(book.id)}
              />
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  )
}

function TagFilterRow({
  tags,
  active,
  onToggle,
  onClear,
}: {
  tags: [string, number][]
  active: Set<string>
  onToggle: (tag: string) => void
  onClear: () => void
}) {
  return (
    <div className="mb-4 -mx-1 flex flex-wrap items-center gap-1.5">
      {tags.map(([tag, count]) => {
        const isActive = active.has(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`text-xs rounded-full px-2.5 py-1 transition-colors ${
              isActive
                ? 'bg-teal-500 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            {tag}
            <span className={`ml-1 text-[10px] ${isActive ? 'opacity-80' : 'text-slate-400'}`}>
              {count}
            </span>
          </button>
        )
      })}
      {active.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-700 underline ml-1"
        >
          clear
        </button>
      )}
    </div>
  )
}

function SelectionBar({
  selected,
  onCancel,
}: {
  selected: Set<string>
  onCancel: () => void
}) {
  const del = useDeleteBook()
  const [deleting, setDeleting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const onDelete = async () => {
    if (selected.size === 0) return
    const ok = window.confirm(
      `Delete ${selected.size} book${selected.size === 1 ? '' : 's'} and all their editions, notes, etc.?\n\nThis cannot be undone.`,
    )
    if (!ok) return
    const ids = [...selected]
    setProgress({ done: 0, total: ids.length })
    setDeleting(true)
    for (let i = 0; i < ids.length; i++) {
      try {
        await del.mutateAsync(ids[i])
      } catch {
        // ignore single failure, continue
      }
      setProgress({ done: i + 1, total: ids.length })
    }
    setDeleting(false)
    onCancel()
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 px-4 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto rounded-full bg-slate-900 text-white shadow-xl flex items-center gap-2 px-3 py-2">
        <span className="text-sm font-medium ml-1">
          {deleting
            ? `Deleting ${progress.done}/${progress.total}…`
            : `${selected.size} selected`}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting || selected.size === 0}
          className="inline-flex items-center gap-1 rounded-full bg-rose-500 hover:bg-rose-600 px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function BookcaseCard({
  book,
  summary,
  onTbrTop,
  selectMode,
  selected,
  onLongPress,
  onToggleSelect,
}: {
  book: BookRow
  summary?: EditionSummary
  onTbrTop?: boolean
  selectMode?: boolean
  selected?: boolean
  onLongPress?: () => void
  onToggleSelect?: () => void
}) {
  const navigate = useNavigate()
  const formats = summary?.formats ?? new Set<Format>()

  // Status icon precedence: TBR top > Reading > Read > none.
  const statusIcon = onTbrTop
    ? { Icon: BookMarked, color: 'bg-amber-500', label: 'On TBR top' }
    : summary?.status === 'reading'
      ? { Icon: BookOpen, color: 'bg-sky-500', label: 'Currently reading' }
      : summary?.status === 'read'
        ? { Icon: CheckCircle2, color: 'bg-emerald-500', label: 'Read' }
        : null

  const timerRef = useRef<number | null>(null)
  const triggeredRef = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    triggeredRef.current = false
    timerRef.current = window.setTimeout(() => {
      triggeredRef.current = true
      onLongPress?.()
    }, 500)
  }
  const cancelTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  const onClick = (e: React.MouseEvent) => {
    // If long-press triggered, swallow the click.
    if (triggeredRef.current) {
      e.preventDefault()
      triggeredRef.current = false
      return
    }
    if (selectMode) {
      e.preventDefault()
      onToggleSelect?.()
      return
    }
    navigate(`/book/${book.id}`)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={book.title}
      onPointerDown={onPointerDown}
      onPointerUp={cancelTimer}
      onPointerLeave={cancelTimer}
      onPointerCancel={cancelTimer}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      className="block group cursor-pointer select-none [-webkit-touch-callout:none]"
    >
      <div className="relative">
        <Cover
          path={book.cover_path}
          title={book.title}
          authors={book.authors}
          version={book.updated_at}
          className={`aspect-[2/3] w-full rounded-lg shadow-sm transition-all ${
            selected
              ? 'ring-2 ring-teal-500 brightness-95'
              : 'group-hover:shadow-md group-hover:ring-1 group-hover:ring-slate-200'
          }`}
        />
        {selectMode && (
          <span
            className={`absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-white shadow ring-1 ring-white/40 ${
              selected ? 'bg-teal-500' : 'bg-white/80 text-slate-400'
            }`}
            aria-hidden="true"
          >
            {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
          </span>
        )}
        {statusIcon && (
          <span
            className={`absolute top-1.5 left-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full ${statusIcon.color} text-white shadow ring-1 ring-white/40`}
            title={statusIcon.label}
            aria-label={statusIcon.label}
          >
            <statusIcon.Icon className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="mt-2">
        <h3 className="text-xs font-semibold text-slate-900 leading-tight line-clamp-2">
          {book.title}
        </h3>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {book.authors.join(', ') || 'Unknown author'}
        </p>
        {formats.size > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 text-slate-400">
            {[...formats].map((fmt) => {
              const meta = FORMAT_META[fmt] ?? FORMAT_META.other
              const Icon = meta.Icon
              return (
                <Icon
                  key={fmt}
                  className="h-3.5 w-3.5"
                  aria-label={meta.label}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function filterAndSort(
  books: BookRow[],
  search: string,
  sort: SortKey,
  activeTags: Set<string>,
): BookRow[] {
  let result = books

  const q = search.trim().toLowerCase()
  if (q) {
    result = result.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.authors.some((a) => a.toLowerCase().includes(q)),
    )
  }

  if (activeTags.size > 0) {
    result = result.filter((b) =>
      [...activeTags].every((t) => b.tags.includes(t)),
    )
  }

  if (sort === 'title') {
    result = [...result].sort((a, b) => a.title.localeCompare(b.title))
  } else if (sort === 'author') {
    result = [...result].sort((a, b) => {
      const aA = (a.authors[0] ?? '').toLowerCase()
      const bA = (b.authors[0] ?? '').toLowerCase()
      return aA.localeCompare(bA)
    })
  }
  // 'added', 'group_*' keep the query's natural order; grouping sorts inside groupBooks.

  return result
}

