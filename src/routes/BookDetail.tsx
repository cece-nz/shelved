import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Trash2, Send, BookMarked, BookOpen, CheckCircle2, ChevronUp, ChevronDown, X, Image as ImageIcon, Upload, Plus, Pencil, Check } from 'lucide-react'
import {
  useBook,
  useBooks,
  useBookFacetValues,
  useDeleteBook,
  useSetCoverFromFile,
  useSetCoverFromUrl,
  useUpdateBook,
  useUpdateReadingStatus,
} from '../queries/books.ts'
import {
  useEditions,
  useDeleteEdition,
  useUpdateEdition,
  type UpdateEditionInput,
} from '../queries/editions.ts'
import { EditionCoverEditor } from '../components/EditionCoverEditor.tsx'
import { PastDateInput } from '../components/PastDateInput.tsx'
import { LoadingButton } from '../components/LoadingButton.tsx'
import { StoreSelect } from '../components/StoreSelect.tsx'
import { AutofillInput } from '../components/AutofillInput.tsx'
import { FacetSelect } from '../components/FacetSelect.tsx'
import { useNotes, useAddNote, useDeleteNote } from '../queries/notes.ts'
import {
  useBookListMembership,
  useAddToTbr,
  useRemoveFromTbr,
} from '../queries/lists.ts'
import { useStores } from '../queries/stores.ts'
import { Cover } from '../components/Cover.tsx'
import { FormatBadge } from '../components/FormatBadge.tsx'
import { StarRating } from '../components/StarRating.tsx'
import { formatDate } from '../lib/dates.ts'
import type { Condition, EditionRow, NoteRow, ReadingStatus } from '../lib/database.types.ts'

export function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: book, isPending, error } = useBook(id)
  const { data: editions = [] } = useEditions(id)

  return (
    <>
      <title>{book ? `${book.title} · Shelved` : 'Book · Shelved'}</title>

      <header className="mb-4">
        <Link
          to="/"
          aria-label="Back to bookcase"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
      </header>

      {isPending && <p className="text-sm text-slate-500">Loading…</p>}
      {error && (
        <p className="text-sm text-rose-600">
          Failed to load: {error.message}
        </p>
      )}

      {book && (
        <>
          <div className="flex gap-4 sm:gap-6">
            <div className="shrink-0">
              <Cover
                path={book.cover_path}
                title={book.title}
                authors={book.authors}
                version={book.updated_at}
                className="w-32 h-48 sm:w-44 sm:h-64 shadow-md rounded-md"
              />
            </div>
            <MetadataBlock
              book={book}
              pageCount={
                editions.find((e) => e.page_count != null)?.page_count ?? null
              }
            />
          </div>

          {book.description && (
            <p className="mt-5 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {book.description}
            </p>
          )}

          <section className="mt-5">
            <h2 className="text-sm font-medium text-slate-700 mb-2">
              Classification
            </h2>
            <ClassificationBlock book={book} />
          </section>

          <TbrControls bookId={book.id} />
          <Editions editions={editions} book={book} />
          <Notes bookId={book.id} />
          <SeriesShelf book={book} />
          <MoreByAuthor book={book} />
          <DangerZone bookId={book.id} title={book.title} />
        </>
      )}
    </>
  )
}

function MetadataBlock({
  book,
  pageCount,
}: {
  book: import('../lib/database.types.ts').BookRow
  pageCount?: number | null
}) {
  const [editing, setEditing] = useState(false)
  const update = useUpdateBook(book.id)
  const facets = useBookFacetValues()
  const [title, setTitle] = useState(book.title)
  const [authors, setAuthors] = useState(book.authors.join(', '))
  const [year, setYear] = useState(book.published_year?.toString() ?? '')
  const [seriesName, setSeriesName] = useState(book.series_name ?? '')
  const [seriesIndex, setSeriesIndex] = useState(
    book.series_index?.toString() ?? '',
  )
  const [description, setDescription] = useState(book.description ?? '')

  const onSave = async () => {
    const trimmedYear = year.trim()
    const trimmedSeriesIdx = seriesIndex.trim()
    try {
      await update.mutateAsync({
        title: title.trim(),
        authors: authors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        published_year:
          trimmedYear === ''
            ? null
            : Number.isFinite(Number(trimmedYear))
              ? Number(trimmedYear)
              : null,
        series_name: seriesName.trim() || null,
        series_index:
          trimmedSeriesIdx === ''
            ? null
            : Number.isFinite(Number(trimmedSeriesIdx))
              ? Number(trimmedSeriesIdx)
              : null,
        description: description.trim() || null,
      })
      setEditing(false)
    } catch {
      // error rendered below
    }
  }

  const onCancel = () => {
    setTitle(book.title)
    setAuthors(book.authors.join(', '))
    setYear(book.published_year?.toString() ?? '')
    setSeriesName(book.series_name ?? '')
    setSeriesIndex(book.series_index?.toString() ?? '')
    setDescription(book.description ?? '')
    update.reset()
    setEditing(false)
  }

  if (!editing) {
    const metaBits: string[] = []
    if (book.published_year) metaBits.push(String(book.published_year))
    if (pageCount != null) metaBits.push(`${pageCount} pages`)

    return (
      <div className="min-w-0 flex-1 space-y-2">
        {book.series_name && (
          <p className="text-xs text-slate-600">
            {book.series_index != null && `#${book.series_index} of `}
            <Link
              to={`/series/${encodeURIComponent(book.series_name)}`}
              className="text-slate-700 hover:text-teal-700 hover:underline"
            >
              {book.series_name}
            </Link>
          </p>
        )}
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-slate-900 leading-tight">
          {book.title}
        </h1>
        <p className="text-sm text-slate-700">
          By{' '}
          {book.authors.length > 0
            ? book.authors.map((a, i) => (
                <span key={a}>
                  {i > 0 && ', '}
                  <Link
                    to={`/author/${encodeURIComponent(a)}`}
                    className="text-slate-900 font-medium hover:text-teal-700 hover:underline"
                  >
                    {a}
                  </Link>
                </span>
              ))
            : 'Unknown author'}
        </p>
        <div className="pt-1.5">
          <ReadingStatusDropdown book={book} />
        </div>
        {metaBits.length > 0 && (
          <p className="text-xs text-slate-500">{metaBits.join(' · ')}</p>
        )}
        <div className="pt-1">
          <StarRating
            value={book.rating}
            onChange={(v) => update.mutate({ rating: v })}
            size="sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-slate-500 hover:text-teal-700 hover:underline inline-flex items-center gap-1 pt-1"
        >
          <Pencil className="h-3 w-3" /> Edit details
        </button>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-2 w-full">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
      />
      <input
        type="text"
        value={authors}
        onChange={(e) => setAuthors(e.target.value)}
        placeholder="Author(s), comma-separated"
        className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
      />
      <input
        type="number"
        min="0"
        max="9999"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        placeholder="Year"
        className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
      />
      <div className="grid grid-cols-[2fr_1fr] gap-1.5">
        <AutofillInput
          options={facets.series}
          type="text"
          value={seriesName}
          onChange={(e) => setSeriesName(e.target.value)}
          placeholder="Series (optional)"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
        />
        <input
          type="number"
          step="0.5"
          value={seriesIndex}
          onChange={(e) => setSeriesIndex(e.target.value)}
          placeholder="#"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={4}
        className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
      />
      <div>
        <p className="text-xs text-slate-600 mb-1">Cover image</p>
        <CoverUrlEditor bookId={book.id} hasCover={Boolean(book.cover_path)} />
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onSave}
          disabled={update.isPending}
          className="inline-flex items-center gap-1 rounded-full bg-teal-500 hover:bg-teal-600 text-white text-xs px-3 py-1.5 disabled:opacity-60"
        >
          <Check className="h-3 w-3" />
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 text-slate-700 text-xs px-3 py-1.5 hover:bg-slate-50"
        >
          <X className="h-3 w-3" /> Cancel
        </button>
      </div>
      {update.error && (
        <p className="text-xs text-rose-600">{update.error.message}</p>
      )}
    </div>
  )
}

const STATUS_META: Record<
  ReadingStatus,
  { label: string; Icon: typeof BookMarked; bg: string; text: string }
> = {
  want_to_read: {
    label: 'Want to Read',
    Icon: BookMarked,
    bg: 'bg-amber-400 hover:bg-amber-500',
    text: 'text-amber-900',
  },
  reading: {
    label: 'In Progress',
    Icon: BookOpen,
    bg: 'bg-sky-400 hover:bg-sky-500',
    text: 'text-sky-900',
  },
  read: {
    label: 'Read',
    Icon: CheckCircle2,
    bg: 'bg-emerald-500 hover:bg-emerald-600',
    text: 'text-white',
  },
}

function ReadingStatusDropdown({
  book,
}: {
  book: import('../lib/database.types.ts').BookRow
}) {
  const [open, setOpen] = useState(false)
  const update = useUpdateReadingStatus(book.id)
  const current = book.reading_status ? STATUS_META[book.reading_status] : null

  const choose = (status: ReadingStatus | null) => {
    update.mutate(status)
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={update.isPending}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold shadow-sm disabled:opacity-70 ${
          current
            ? `${current.bg} ${current.text}`
            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
        }`}
      >
        {current ? (
          <>
            <current.Icon className="h-4 w-4" />
            {current.label}
          </>
        ) : (
          <>Set status</>
        )}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full mt-1 z-40 w-52 rounded-xl border border-slate-200 bg-white shadow-xl p-1.5">
            {(Object.keys(STATUS_META) as ReadingStatus[]).map((s) => {
              const meta = STATUS_META[s]
              const isCurrent = book.reading_status === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => choose(s)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-slate-50 ${
                    isCurrent ? 'text-slate-900 font-semibold' : 'text-slate-700'
                  }`}
                >
                  <meta.Icon className="h-4 w-4 text-slate-600" />
                  {meta.label}
                </button>
              )
            })}
            {book.reading_status && (
              <button
                type="button"
                onClick={() => choose(null)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-50 border-t border-slate-100 mt-1"
              >
                Clear status
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SeriesShelf({ book }: { book: import('../lib/database.types.ts').BookRow }) {
  const { data: books = [] } = useBooks()
  if (!book.series_name) return null
  const others = books
    .filter((b) => b.series_name === book.series_name && b.id !== book.id)
    .sort(
      (a, b) =>
        (a.series_index ?? Number.MAX_SAFE_INTEGER) -
        (b.series_index ?? Number.MAX_SAFE_INTEGER),
    )
  if (others.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-slate-700 mb-2">
        Series ·{' '}
        <Link
          to={`/series/${encodeURIComponent(book.series_name)}`}
          className="text-slate-700 hover:text-teal-700 hover:underline"
        >
          {book.series_name}
        </Link>
      </h2>
      <ShelfRow books={others} showSeriesIndex />
    </section>
  )
}

function MoreByAuthor({ book }: { book: import('../lib/database.types.ts').BookRow }) {
  const { data: books = [] } = useBooks()
  const primary = book.authors[0]
  if (!primary) return null
  const others = books
    .filter(
      (b) =>
        b.id !== book.id &&
        b.authors.includes(primary) &&
        // Already shown in the series shelf — don't duplicate.
        (!book.series_name || b.series_name !== book.series_name),
    )
    .sort((a, b) => a.title.localeCompare(b.title))
  if (others.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-slate-700 mb-2">
        More by{' '}
        <Link
          to={`/author/${encodeURIComponent(primary)}`}
          className="text-slate-700 hover:text-teal-700 hover:underline"
        >
          {primary}
        </Link>
      </h2>
      <ShelfRow books={others} />
    </section>
  )
}

function ShelfRow({
  books,
  showSeriesIndex,
}: {
  books: import('../lib/database.types.ts').BookRow[]
  showSeriesIndex?: boolean
}) {
  return (
    <ul className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
      {books.map((b) => (
        <li key={b.id} className="w-24 sm:w-28 shrink-0 snap-start">
          <Link to={`/book/${b.id}`} className="block group">
            <div className="relative">
              <Cover
                path={b.cover_path}
                title={b.title}
                authors={b.authors}
                version={b.updated_at}
                className="aspect-[2/3] w-full rounded-md shadow-sm group-hover:shadow-md transition-shadow"
              />
              {showSeriesIndex && b.series_index != null && (
                <span className="absolute bottom-1 right-1 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-400 text-amber-900 text-[10px] font-bold shadow">
                  #{b.series_index}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-700 leading-tight line-clamp-2">
              {b.title}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ClassificationBlock({
  book,
}: {
  book: import('../lib/database.types.ts').BookRow
}) {
  const update = useUpdateBook(book.id)
  const facets = useBookFacetValues()

  return (
    <div className="space-y-3">
      <FacetRow label="Reading age">
        <FacetSelect
          value={book.reading_age ?? ''}
          onChange={(v) => update.mutate({ reading_age: v || null })}
          options={facets.readingAges}
        />
      </FacetRow>
      <FacetRow label="Genre">
        <FacetSelect
          value={book.genre ?? ''}
          onChange={(v) => update.mutate({ genre: v || null, sub_genre: null })}
          options={facets.genres}
        />
      </FacetRow>
      <FacetRow label="Sub genre">
        <FacetSelect
          value={book.sub_genre ?? ''}
          onChange={(v) => update.mutate({ sub_genre: v || null })}
          options={facets.subGenresFor(book.genre)}
          disabled={!book.genre}
          placeholder={book.genre ? 'Not set' : 'Pick a genre first'}
        />
      </FacetRow>
      <FacetRow label="Mood">
        <FacetSelect
          value={book.mood ?? ''}
          onChange={(v) => update.mutate({ mood: v || null })}
          options={facets.moods}
        />
      </FacetRow>
    </div>
  )
}

function FacetRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-1">{label}</p>
      {children}
    </div>
  )
}

function DangerZone({ bookId, title }: { bookId: string; title: string }) {
  const navigate = useNavigate()
  const del = useDeleteBook()

  const onDelete = async () => {
    const ok = window.confirm(
      `Delete "${title}" and all its editions, notes, quotes, and bookmarks?\n\nThis cannot be undone.`,
    )
    if (!ok) return
    try {
      await del.mutateAsync(bookId)
      navigate('/')
    } catch {
      // error rendered below
    }
  }

  return (
    <div className="mt-12 pt-6 border-t border-slate-200">
      <button
        type="button"
        onClick={onDelete}
        disabled={del.isPending}
        className="text-xs text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 disabled:opacity-60"
      >
        <Trash2 className="h-3 w-3" />
        {del.isPending ? 'Deleting…' : 'Delete this book'}
      </button>
      {del.error && (
        <p className="text-xs text-rose-600 mt-1">{del.error.message}</p>
      )}
    </div>
  )
}

// ============================================================
// TBR controls (add / promote / demote / remove)
// ============================================================

function TbrControls({ bookId }: { bookId: string }) {
  const { data: memberships = [] } = useBookListMembership(bookId)
  const add = useAddToTbr()
  const remove = useRemoveFromTbr()

  const tbr = memberships.find(
    (m) => m.list_kind === 'tbr_top' || m.list_kind === 'tbr_pool',
  )

  return (
    <section className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <BookMarked className="h-4 w-4 text-slate-500 shrink-0" />
        <span className="text-sm text-slate-700">
          {tbr
            ? tbr.list_kind === 'tbr_top'
              ? `On TBR top${tbr.position != null ? ` (#${tbr.position})` : ''}`
              : 'On TBR pool'
            : 'Not on TBR'}
        </span>

        <div className="ml-auto flex flex-wrap gap-1">
          {!tbr && (
            <>
              <PillButton
                onClick={() => add.mutate({ bookId, kind: 'tbr_pool' })}
                disabled={add.isPending}
              >
                Add to pool
              </PillButton>
              <PillButton
                onClick={() => add.mutate({ bookId, kind: 'tbr_top' })}
                disabled={add.isPending}
                primary
              >
                Add to top
              </PillButton>
            </>
          )}

          {tbr?.list_kind === 'tbr_pool' && (
            <PillButton
              onClick={() => add.mutate({ bookId, kind: 'tbr_top' })}
              disabled={add.isPending}
              primary
            >
              <ChevronUp className="h-3.5 w-3.5" /> Promote to top
            </PillButton>
          )}

          {tbr?.list_kind === 'tbr_top' && (
            <PillButton
              onClick={() => add.mutate({ bookId, kind: 'tbr_pool' })}
              disabled={add.isPending}
            >
              <ChevronDown className="h-3.5 w-3.5" /> Move to pool
            </PillButton>
          )}

          {tbr && (
            <PillButton
              onClick={() => remove.mutate(bookId)}
              disabled={remove.isPending}
            >
              <X className="h-3.5 w-3.5" /> Remove
            </PillButton>
          )}
        </div>
      </div>

      {add.error && (
        <p className="mt-2 text-xs text-rose-600">{add.error.message}</p>
      )}
    </section>
  )
}

function PillButton({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs disabled:opacity-60 ${
        primary
          ? 'bg-teal-500 text-white hover:bg-teal-600'
          : 'border border-slate-300 text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

// ============================================================
// Editions list (with delete + per-edition cover + add new edition)
// ============================================================

function Editions({ editions, book }: { editions: EditionRow[]; book: import('../lib/database.types.ts').BookRow }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-slate-700">
          Editions ({editions.length})
        </h2>
        <Link
          to={`/add?attach=${book.id}`}
          className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-500 hover:bg-teal-600 text-white"
        >
          <Plus className="h-3 w-3" /> Add edition
        </Link>
      </div>

      {editions.length === 0 && (
        <p className="text-xs text-slate-500">
          No editions left. Add one to get started.
        </p>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {editions.map((edition) => (
          <EditionCard
            key={edition.id}
            edition={edition}
            book={book}
          />
        ))}
      </ul>
    </section>
  )
}

function EditionCard({
  edition,
  book,
}: {
  edition: EditionRow
  book: import('../lib/database.types.ts').BookRow
}) {
  const [editing, setEditing] = useState(false)
  const del = useDeleteEdition()

  const coverPath = edition.cover_path ?? book.cover_path
  const coverVersion = edition.cover_path
    ? edition.updated_at
    : book.updated_at

  if (editing) {
    return (
      <li className="rounded-md border border-teal-200 bg-white p-2.5 sm:col-span-2">
        <EditionEditForm
          edition={edition}
          book={book}
          onClose={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="rounded-md border border-slate-200 bg-white p-2">
      <div className="flex gap-2">
        <Cover
          path={coverPath}
          title={book.title}
          authors={book.authors}
          version={coverVersion}
          className="w-10 h-14 shrink-0 rounded"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="flex flex-wrap items-center gap-1 min-w-0">
              <FormatBadge format={edition.format} />
              {edition.is_preorder && (
                <span className="text-[9px] font-medium px-1 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Pre
                </span>
              )}
            </div>
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit edition"
                className="p-0.5 text-slate-400 hover:text-teal-600"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this edition? This cannot be undone.')) {
                    del.mutate(edition.id)
                  }
                }}
                aria-label="Delete edition"
                disabled={del.isPending}
                className="p-0.5 text-slate-400 hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          {edition.display_name && (
            <p className="text-xs font-medium text-slate-800 truncate">
              {edition.display_name}
            </p>
          )}
          {edition.isbn && (
            <p className="text-[10px] font-mono text-slate-500 truncate">
              {edition.isbn}
            </p>
          )}
          <EditionMeta edition={edition} compact />
        </div>
      </div>
    </li>
  )
}

function EditionEditForm({
  edition,
  onClose,
}: {
  edition: EditionRow
  book: import('../lib/database.types.ts').BookRow
  onClose: () => void
}) {
  const update = useUpdateEdition(edition.id, edition.book_id)
  const pubYear = edition.publication_date?.slice(0, 4) ?? ''

  const [format, setFormat] = useState(edition.format)
  const [displayName, setDisplayName] = useState(edition.display_name ?? '')
  const [isbn, setIsbn] = useState(edition.isbn ?? '')
  const [publisher, setPublisher] = useState(edition.publisher ?? '')
  const [publishedYear, setPublishedYear] = useState(pubYear)
  const [pageCount, setPageCount] = useState(
    edition.page_count != null ? String(edition.page_count) : '',
  )
  const [purchaseDate, setPurchaseDate] = useState(edition.purchase_date ?? '')
  const [purchasePrice, setPurchasePrice] = useState(
    edition.purchase_price != null ? String(edition.purchase_price) : '',
  )
  const purchaseLocation = edition.purchase_location ?? ''
  const [storeId, setStoreId] = useState(edition.store_id ?? '')
  const [isPreorder, setIsPreorder] = useState(edition.is_preorder)
  const [condition, setCondition] = useState<string>(edition.condition ?? '')
  const [isPurchased, setIsPurchased] = useState(
    edition.acquired === 'purchased',
  )
  const [isLibrary, setIsLibrary] = useState(edition.acquired === 'library')
  const isEbook = format === 'ebook'

  const togglePurchased = (checked: boolean) => {
    setIsPurchased(checked)
    if (checked) setIsLibrary(false)
  }
  const toggleLibrary = (checked: boolean) => {
    setIsLibrary(checked)
    if (checked) setIsPurchased(false)
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const yearTrim = publishedYear.trim()
    const pagesTrim = pageCount.trim()
    const priceTrim = purchasePrice.trim()
    const input: UpdateEditionInput = {
      format,
      isbn: isEbook ? null : isbn.trim() || null,
      publisher: publisher.trim() || null,
      publicationYear:
        yearTrim === '' ? null : Number.isFinite(Number(yearTrim)) ? Number(yearTrim) : null,
      pageCount:
        pagesTrim === '' ? null : Number.isFinite(Number(pagesTrim)) ? Number(pagesTrim) : null,
      durationSeconds: edition.duration_seconds,
      purchaseDate: isPurchased ? purchaseDate || null : null,
      purchaseLocation: isPurchased ? purchaseLocation.trim() || null : null,
      purchasePrice:
        isPurchased && priceTrim !== '' && Number.isFinite(Number(priceTrim))
          ? Number(priceTrim)
          : null,
      condition:
        isPurchased && !isEbook
          ? ((condition || null) as Condition | null)
          : null,
      startedAt: edition.started_at,
      finishedAt: edition.finished_at,
      isTrophy: edition.is_trophy,
      storeId: isPurchased ? storeId || null : null,
      isPreorder: isPurchased ? isPreorder : false,
      displayName: isEbook ? null : displayName.trim() || null,
      acquired: isPurchased ? 'purchased' : isLibrary ? 'library' : 'unknown',
    }
    await update.mutateAsync(input)
    onClose()
  }

  return (
    <form onSubmit={onSave} className="space-y-2">
      <p className="text-xs font-medium text-slate-700">Edit edition</p>

      <div>
        <p className="text-[10px] text-slate-600 mb-0.5">Cover image</p>
        <EditionCoverEditor
          editionId={edition.id}
          bookId={edition.book_id}
          hasEditionCover={Boolean(edition.cover_path)}
        />
      </div>

      {/* Format + ISBN (ISBN hidden for ebooks) */}
      <div className={`grid gap-2 ${isEbook ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <label className="block text-[10px] text-slate-600">
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white"
          >
            <option value="paperback">Paperback</option>
            <option value="hardcover">Hardcover</option>
            <option value="ebook">ePub</option>
            <option value="audiobook">Audiobook</option>
            <option value="special_edition">Special</option>
            <option value="other">Other</option>
          </select>
        </label>
        {!isEbook && (
          <label className="block text-[10px] text-slate-600">
            ISBN
            <input
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono bg-white"
            />
          </label>
        )}
      </div>

      {!isEbook && (
        <label className="block text-[10px] text-slate-600">
          Edition name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white"
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] text-slate-600">
          Publisher
          <input
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white"
          />
        </label>
        <label className="block text-[10px] text-slate-600">
          Year
          <input
            type="number"
            min="0"
            max="9999"
            value={publishedYear}
            onChange={(e) => setPublishedYear(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white"
          />
        </label>
      </div>

      <label className="block text-[10px] text-slate-600">
        Pages
        <input
          type="number"
          min="0"
          value={pageCount}
          onChange={(e) => setPageCount(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white"
        />
      </label>

      {/* Acquired — both optional, mutually exclusive */}
      <div className="space-y-1 pt-0.5">
        <p className="text-[10px] font-medium text-slate-600">Acquired</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={isPurchased}
              onChange={(e) => togglePurchased(e.target.checked)}
              className="accent-teal-500"
            />
            Purchased
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={isLibrary}
              onChange={(e) => toggleLibrary(e.target.checked)}
              className="accent-teal-500"
            />
            Library
          </label>
        </div>
        {!isPurchased && (
          <p className="text-[10px] text-slate-400">
            {isLibrary ? 'Acquired: Library' : 'Acquired: not set'}
          </p>
        )}
      </div>

      {isPurchased && (
        <div className="rounded border border-slate-200 p-2 space-y-2">
          <p className="text-[10px] font-medium text-slate-600">Acquired info</p>
          {!isEbook && (
            <label className="block text-[10px] text-slate-600">
              Condition
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white"
              >
                <option value="">Not set</option>
                <option value="new">New</option>
                <option value="second_hand">Second hand</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
          )}
          <label className="block text-[10px] text-slate-600">
            Location
            <StoreSelect value={storeId} onChange={setStoreId} className="mt-0.5" />
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={isPreorder}
              onChange={(e) => setIsPreorder(e.target.checked)}
              className="accent-teal-500"
            />
            Pre-order
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[10px] text-slate-600">
              Bought on
              <PastDateInput
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white"
              />
            </label>
            <label className="block text-[10px] text-slate-600">
              Price (NZD)
              <input
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white"
              />
            </label>
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <LoadingButton
          type="submit"
          pending={update.isPending}
          pendingLabel="Saving…"
          className="flex-1 rounded-md bg-teal-500 hover:bg-teal-600 px-3 py-1.5 text-xs text-white"
        >
          Save
        </LoadingButton>
        <button
          type="button"
          onClick={onClose}
          disabled={update.isPending}
          className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
      {update.error && (
        <p className="text-[10px] text-rose-600">{update.error.message}</p>
      )}
    </form>
  )
}

// ============================================================
// Cover editor — paste URL fallback
// ============================================================

function CoverUrlEditor({
  bookId,
  hasCover,
}: {
  bookId: string
  hasCover: boolean
}) {
  const [mode, setMode] = useState<'collapsed' | 'open' | 'url'>(
    hasCover ? 'collapsed' : 'open',
  )
  const [url, setUrl] = useState('')
  const setFromFile = useSetCoverFromFile(bookId)
  const setFromUrl = useSetCoverFromUrl(bookId)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await setFromFile.mutateAsync(file)
      e.target.value = ''
      if (hasCover) setMode('collapsed')
    } catch {
      // mutation error rendered below
    }
  }

  const onUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    try {
      await setFromUrl.mutateAsync(trimmed)
      setUrl('')
      if (hasCover) setMode('collapsed')
    } catch {
      // mutation error rendered below
    }
  }

  const reset = () => {
    setMode('collapsed')
    setUrl('')
    setFromUrl.reset()
    setFromFile.reset()
  }

  if (mode === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setMode('open')}
        className="text-[11px] text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
      >
        <ImageIcon className="h-3 w-3" />
        Replace cover
      </button>
    )
  }

  return (
    <div className="space-y-1">
      <label className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-teal-500 hover:bg-teal-600 text-white cursor-pointer w-fit">
        <Upload className="h-3 w-3" />
        {setFromFile.isPending ? 'Uploading…' : 'Upload image'}
        <input
          type="file"
          accept="image/*"
          onChange={onFile}
          disabled={setFromFile.isPending}
          className="hidden"
        />
      </label>

      {mode === 'open' ? (
        <button
          type="button"
          onClick={() => setMode('url')}
          className="block text-[10px] text-slate-500 hover:text-slate-700 underline"
        >
          or paste a URL
        </button>
      ) : (
        <form onSubmit={onUrlSubmit} className="space-y-1">
          <input
            type="url"
            inputMode="url"
            placeholder="Paste image URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-28 rounded-md border border-slate-200 px-2 py-1 text-[11px]"
          />
          <button
            type="submit"
            disabled={setFromUrl.isPending || !url.trim()}
            className="text-[11px] font-medium px-2 py-1 rounded-full bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-60"
          >
            {setFromUrl.isPending ? 'Saving…' : 'Save URL'}
          </button>
        </form>
      )}

      {hasCover && (
        <button
          type="button"
          onClick={reset}
          className="block text-[10px] text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      )}

      {(setFromFile.error || setFromUrl.error) && (
        <p className="text-[10px] text-rose-600">
          {(setFromFile.error ?? setFromUrl.error)!.message.includes(
            'Failed to fetch',
          )
            ? 'Could not fetch (CORS). Try a different host.'
            : (setFromFile.error ?? setFromUrl.error)!.message}
        </p>
      )}
    </div>
  )
}

function EditionMeta({
  edition,
  compact = false,
}: {
  edition: EditionRow
  compact?: boolean
}) {
  const { data: stores = [] } = useStores()
  const storeName = edition.store_id
    ? stores.find((s) => s.id === edition.store_id)?.name ?? null
    : null

  const bits: string[] = []
  if (edition.page_count != null) bits.push(`${edition.page_count}p`)
  if (edition.publication_date && !compact)
    bits.push(`pub. ${formatDate(edition.publication_date)}`)

  const purchaseBits: string[] = []
  if (edition.acquired === 'library') {
    purchaseBits.push('Library')
  } else {
    if (storeName) purchaseBits.push(storeName)
    if (edition.purchase_date)
      purchaseBits.push(formatDate(edition.purchase_date))
    if (edition.purchase_price != null) {
      const currency = edition.currency ?? 'NZD'
      purchaseBits.push(`${currency} ${edition.purchase_price}`)
    }
  }

  const line = [...bits, ...purchaseBits].join(' · ')
  if (!line) return null

  return (
    <p className={`text-slate-500 truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
      {line}
    </p>
  )
}

// ============================================================
// Notes (feed-style: add at top, list newest-first)
// ============================================================

function Notes({ bookId }: { bookId: string }) {
  const { data: notes = [], isPending } = useNotes(bookId)
  const add = useAddNote(bookId)
  const del = useDeleteNote(bookId)
  const [body, setBody] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    await add.mutateAsync(trimmed)
    setBody('')
  }

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-slate-700 mb-2">Notes</h2>

      <form onSubmit={onSubmit} className="mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add a note as you read…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {body.length > 0 ? `${body.length} chars` : ''}
          </span>
          <button
            type="submit"
            disabled={add.isPending || body.trim() === ''}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-500 hover:bg-teal-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {add.isPending ? 'Saving…' : 'Add note'}
          </button>
        </div>
        {add.error && (
          <p className="text-xs text-rose-600 mt-1">{add.error.message}</p>
        )}
      </form>

      {isPending && <p className="text-xs text-slate-500">Loading notes…</p>}

      {!isPending && notes.length === 0 && (
        <p className="text-xs text-slate-500">No notes yet.</p>
      )}

      <ul className="space-y-3">
        {notes.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            onDelete={() => del.mutate(note.id)}
            deleting={del.isPending && del.variables === note.id}
          />
        ))}
      </ul>
    </section>
  )
}

function NoteItem({
  note,
  onDelete,
  deleting,
}: {
  note: NoteRow
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <li className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <time
          dateTime={note.created_at}
          className="text-xs text-slate-500"
          title={new Date(note.created_at).toLocaleString()}
        >
          {formatNoteDate(note.created_at)}
        </time>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Delete note"
          className="p-1 -m-1 text-slate-400 hover:text-rose-600 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-sm text-slate-800 whitespace-pre-line">{note.body}</p>
    </li>
  )
}

/** Display "today" / "yesterday" / "3 days ago" / absolute date for older. */
function formatNoteDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays < 0)
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  if (diffDays === 0) return `Today at ${formatTime(d)}`
  if (diffDays === 1) return `Yesterday at ${formatTime(d)}`
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}
