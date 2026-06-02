import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Trash2, Send, BookMarked, ChevronUp, ChevronDown, X, Image as ImageIcon, Upload, Plus, Trophy, Pencil, Check } from 'lucide-react'
import {
  useBook,
  useDeleteBook,
  useSetCoverFromFile,
  useSetCoverFromUrl,
  useUpdateBook,
} from '../queries/books.ts'
import {
  useEditions,
  useDeleteEdition,
  useAddEdition,
  useSetEditionCoverFromFile,
  useClearEditionCover,
  useUpdateEditionDates,
  useUpdateEditionTrophy,
} from '../queries/editions.ts'
import { useNotes, useAddNote, useDeleteNote } from '../queries/notes.ts'
import {
  useBookListMembership,
  useAddToTbr,
  useRemoveFromTbr,
} from '../queries/lists.ts'
import { Cover } from '../components/Cover.tsx'
import { FormatBadge } from '../components/FormatBadge.tsx'
import { StarRating } from '../components/StarRating.tsx'
import { formatDate } from '../lib/dates.ts'
import type { Condition, EditionRow, Format, NoteRow } from '../lib/database.types.ts'

export function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: book, isPending, error } = useBook(id)
  const { data: editions = [] } = useEditions(id)

  return (
    <>
      <title>{book ? `${book.title} · Shelved` : 'Book · Shelved'}</title>

      <header className="mb-4 flex items-center gap-2">
        <Link
          to="/"
          aria-label="Back to bookcase"
          className="p-1 text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold truncate flex-1">
          {book?.title ?? 'Book'}
        </h1>
      </header>

      {isPending && <p className="text-sm text-slate-500">Loading…</p>}
      {error && (
        <p className="text-sm text-rose-600">
          Failed to load: {error.message}
        </p>
      )}

      {book && (
        <>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 shrink-0">
              <Cover
                path={book.cover_path}
                title={book.title}
                authors={book.authors}
                version={book.updated_at}
                className="w-28 h-40"
              />
              <CoverUrlEditor bookId={book.id} hasCover={Boolean(book.cover_path)} />
            </div>
            <MetadataBlock book={book} />
          </div>

          <TbrControls bookId={book.id} />
          <Editions editions={editions} book={book} />
          <Notes bookId={book.id} />
          <DangerZone bookId={book.id} title={book.title} />
        </>
      )}
    </>
  )
}

function MetadataBlock({ book }: { book: import('../lib/database.types.ts').BookRow }) {
  const [editing, setEditing] = useState(false)
  const update = useUpdateBook(book.id)
  const [title, setTitle] = useState(book.title)
  const [authors, setAuthors] = useState(book.authors.join(', '))
  const [year, setYear] = useState(book.published_year?.toString() ?? '')
  const [genres, setGenres] = useState(book.genres.join(', '))
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
        genres: genres
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
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
    setGenres(book.genres.join(', '))
    setSeriesName(book.series_name ?? '')
    setSeriesIndex(book.series_index?.toString() ?? '')
    setDescription(book.description ?? '')
    update.reset()
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-slate-700">
          {book.authors.length > 0
            ? book.authors.map((a, i) => (
                <span key={a}>
                  {i > 0 && ', '}
                  <Link
                    to={`/author/${encodeURIComponent(a)}`}
                    className="text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    {a}
                  </Link>
                </span>
              ))
            : 'Unknown author'}
        </p>
        {book.published_year && (
          <p className="text-xs text-slate-500">{book.published_year}</p>
        )}
        {book.series_name && (
          <p className="text-xs text-slate-500">
            <Link
              to={`/series/${encodeURIComponent(book.series_name)}`}
              className="text-teal-600 hover:text-teal-700 hover:underline"
            >
              {book.series_name}
            </Link>
            {book.series_index != null && ` · #${book.series_index}`}
          </p>
        )}
        {book.genres.length > 0 && (
          <p className="text-xs text-slate-500">
            {book.genres.slice(0, 4).join(' · ')}
          </p>
        )}
        <div className="pt-1">
          <StarRating
            value={book.rating}
            onChange={(v) => update.mutate({ rating: v })}
            size="sm"
          />
        </div>
        <TagChips book={book} />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-teal-600 hover:text-teal-700 inline-flex items-center gap-1 pt-1"
        >
          <Pencil className="h-3 w-3" /> Edit details
        </button>
        {book.description && (
          <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {book.description}
          </p>
        )}
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
      <input
        type="text"
        value={genres}
        onChange={(e) => setGenres(e.target.value)}
        placeholder="Genres, comma-separated"
        className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
      />
      <div className="grid grid-cols-[2fr_1fr] gap-1.5">
        <input
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

function TagChips({ book }: { book: import('../lib/database.types.ts').BookRow }) {
  const update = useUpdateBook(book.id)
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)

  const addTag = () => {
    const tag = input.trim()
    if (!tag) {
      setAdding(false)
      return
    }
    if (book.tags.includes(tag)) {
      setInput('')
      setAdding(false)
      return
    }
    update.mutate({ tags: [...book.tags, tag] })
    setInput('')
    setAdding(false)
  }

  const removeTag = (tag: string) => {
    update.mutate({ tags: book.tags.filter((t) => t !== tag) })
  }

  return (
    <div className="flex flex-wrap items-center gap-1 pt-1.5">
      {book.tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-teal-100 text-teal-700 text-[10px] font-medium pl-2 pr-1 py-0.5"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            aria-label={`Remove tag ${tag}`}
            className="hover:bg-teal-200 rounded-full p-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={addTag}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            } else if (e.key === 'Escape') {
              setAdding(false)
              setInput('')
            }
          }}
          autoFocus
          placeholder="new tag"
          className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] w-20 focus:outline-none focus:border-teal-300"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400 text-[10px] px-2 py-0.5"
        >
          <Plus className="h-2.5 w-2.5" /> tag
        </button>
      )}
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
  const [addOpen, setAddOpen] = useState(false)

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-slate-700">
          Editions ({editions.length})
        </h2>
        {!addOpen && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-500 hover:bg-teal-600 text-white"
          >
            <Plus className="h-3 w-3" /> Add edition
          </button>
        )}
      </div>

      {editions.length === 0 && !addOpen && (
        <p className="text-xs text-slate-500">
          No editions left. Add one to get started.
        </p>
      )}

      <ul className="space-y-2">
        {editions.map((edition) => (
          <EditionCard
            key={edition.id}
            edition={edition}
            book={book}
          />
        ))}
      </ul>

      {addOpen && (
        <AddEditionForm bookId={book.id} onClose={() => setAddOpen(false)} />
      )}
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
  const del = useDeleteEdition()
  const setCover = useSetEditionCoverFromFile(edition.id, edition.book_id)
  const clearCover = useClearEditionCover(edition.id, edition.book_id)
  const setTrophy = useUpdateEditionTrophy(edition.id, edition.book_id)
  const fileInputId = `edition-cover-${edition.id}`

  // Edition cover wins; otherwise fall back to the book cover; failing
  // both, Cover's placeholder kicks in.
  const coverPath = edition.cover_path ?? book.cover_path
  const coverVersion = edition.cover_path
    ? edition.updated_at
    : book.updated_at

  return (
    <li className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex gap-3">
        <Cover
          path={coverPath}
          title={book.title}
          authors={book.authors}
          version={coverVersion}
          className="w-14 h-20 shrink-0"
        />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <FormatBadge format={edition.format} />
            <div className="flex items-center gap-2">
              {edition.isbn && (
                <span className="text-xs font-mono text-slate-500">
                  {edition.isbn}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this edition? This cannot be undone.')) {
                    del.mutate(edition.id)
                  }
                }}
                aria-label="Delete edition"
                disabled={del.isPending}
                className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <EditionMeta edition={edition} />
          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={edition.is_trophy}
              onChange={(e) => setTrophy.mutate(e.target.checked)}
              disabled={setTrophy.isPending}
              className="accent-teal-500"
            />
            <Trophy className="h-3 w-3 text-amber-500" />
            Trophy book (no dates needed)
          </label>
          {!edition.is_trophy && <ReadingDates edition={edition} />}
          <div className="flex items-center gap-2 pt-1">
            <label
              htmlFor={fileInputId}
              className="text-[11px] text-teal-600 hover:text-teal-700 inline-flex items-center gap-1 cursor-pointer"
            >
              <Upload className="h-3 w-3" />
              {setCover.isPending
                ? 'Uploading…'
                : edition.cover_path
                  ? 'Replace cover'
                  : 'Upload cover'}
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    await setCover.mutateAsync(file)
                    e.target.value = ''
                  } catch {
                    /* error rendered below */
                  }
                }}
                disabled={setCover.isPending}
                className="hidden"
              />
            </label>
            {edition.cover_path && (
              <button
                type="button"
                onClick={() => clearCover.mutate()}
                disabled={clearCover.isPending}
                className="text-[11px] text-slate-500 hover:text-slate-700"
              >
                Use book cover
              </button>
            )}
          </div>
          {setCover.error && (
            <p className="text-[10px] text-rose-600">
              {setCover.error.message}
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

function ReadingDates({ edition }: { edition: EditionRow }) {
  const update = useUpdateEditionDates(edition.id, edition.book_id)
  const [started, setStarted] = useState(edition.started_at ?? '')
  const [finished, setFinished] = useState(edition.finished_at ?? '')
  const isAudio = edition.format === 'audiobook'
  const startLabel = isAudio ? 'Started listening' : 'Started'
  const finishLabel = isAudio ? 'Finished listening' : 'Finished'

  // Save on blur so the user doesn't see a save button per field.
  const save = () => {
    const next = {
      started_at: started || null,
      finished_at: finished || null,
    }
    if (
      next.started_at === edition.started_at &&
      next.finished_at === edition.finished_at
    ) {
      return
    }
    update.mutate(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        {startLabel}
        <input
          type="date"
          value={started}
          onChange={(e) => setStarted(e.target.value)}
          onBlur={save}
          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px]"
        />
      </label>
      <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        {finishLabel}
        <input
          type="date"
          value={finished}
          onChange={(e) => setFinished(e.target.value)}
          onBlur={save}
          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px]"
        />
      </label>
      {update.error && (
        <span className="text-[10px] text-rose-600">{update.error.message}</span>
      )}
    </div>
  )
}

// ----- Add edition inline form -----

const addEditionSchema = z.object({
  format: z.enum([
    'paperback',
    'hardcover',
    'ebook',
    'audiobook',
    'special_edition',
    'other',
  ]),
  isbn: z.string(),
  publisher: z.string(),
  publishedYear: z.string(),
  pageCount: z.string(),
  isTrophy: z.boolean(),
  startedAt: z.string(),
  finishedAt: z.string(),
  purchaseDate: z.string(),
  purchaseLocation: z.string(),
  purchasePrice: z.string(),
  condition: z.string(),
})
type AddEditionFormValues = z.infer<typeof addEditionSchema>

function AddEditionForm({
  bookId,
  onClose,
}: {
  bookId: string
  onClose: () => void
}) {
  const add = useAddEdition()
  const form = useForm<AddEditionFormValues>({
    resolver: zodResolver(addEditionSchema),
    defaultValues: {
      format: 'paperback',
      isbn: '',
      publisher: '',
      publishedYear: '',
      pageCount: '',
      isTrophy: false,
      startedAt: '',
      finishedAt: '',
      purchaseDate: '',
      purchaseLocation: '',
      purchasePrice: '',
      condition: '',
    },
  })

  const onSubmit = async (v: AddEditionFormValues) => {
    const priceTrim = v.purchasePrice.trim()
    const yearTrim = v.publishedYear.trim()
    const pagesTrim = v.pageCount.trim()
    await add.mutateAsync({
      bookId,
      format: v.format as Format,
      isbn: v.isbn.trim() || null,
      publisher: v.publisher.trim() || null,
      publicationYear:
        yearTrim === '' ? null : Number.isFinite(Number(yearTrim)) ? Number(yearTrim) : null,
      pageCount:
        pagesTrim === '' ? null : Number.isFinite(Number(pagesTrim)) ? Number(pagesTrim) : null,
      durationSeconds: null,
      purchaseDate: v.purchaseDate || null,
      purchaseLocation: v.purchaseLocation.trim() || null,
      purchasePrice:
        priceTrim === '' ? null : Number.isFinite(Number(priceTrim)) ? Number(priceTrim) : null,
      condition: (v.condition || null) as Condition | null,
      startedAt: v.isTrophy ? null : v.startedAt || null,
      finishedAt: v.isTrophy ? null : v.finishedAt || null,
      isTrophy: v.isTrophy,
    })
    onClose()
  }

  const isTrophyChecked = form.watch('isTrophy')
  const formatChosen = form.watch('format')
  const audioInForm = formatChosen === 'audiobook'

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mt-3 rounded-md border border-slate-200 bg-white p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">New edition</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel"
          className="p-1 text-slate-400 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="block">
        <span className="block text-xs text-slate-600 mb-1">Format</span>
        <select
          {...form.register('format')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="paperback">Paperback</option>
          <option value="hardcover">Hardcover</option>
          <option value="ebook">eBook</option>
          <option value="audiobook">Audiobook</option>
          <option value="special_edition">Special edition</option>
          <option value="other">Other</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-xs text-slate-600 mb-1">ISBN</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="978…"
            {...form.register('isbn')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-slate-600 mb-1">Pages</span>
          <input
            type="number"
            min="0"
            {...form.register('pageCount')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs text-slate-600 mb-1">Published year</span>
        <input
          type="number"
          min="0"
          max="9999"
          {...form.register('publishedYear')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          {...form.register('isTrophy')}
          className="accent-teal-500"
        />
        <Trophy className="h-3.5 w-3.5 text-amber-500" />
        Trophy book — skip dates
      </label>

      {!isTrophyChecked && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">
              {audioInForm ? 'Started listening' : 'Started'}
            </span>
            <input
              type="date"
              {...form.register('startedAt')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">
              {audioInForm ? 'Finished listening' : 'Finished'}
            </span>
            <input
              type="date"
              {...form.register('finishedAt')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      <details className="rounded-md border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm text-slate-700">
          Purchase details (optional)
        </summary>
        <div className="p-3 pt-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">Purchased on</span>
              <input
                type="date"
                {...form.register('purchaseDate')}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">Price</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register('purchasePrice')}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">Where</span>
            <input
              type="text"
              placeholder="e.g. op-shop"
              {...form.register('purchaseLocation')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-600 mb-1">Condition</span>
            <select
              {...form.register('condition')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Not set</option>
              <option value="new">New</option>
              <option value="second_hand">Second hand</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
        </div>
      </details>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={add.isPending}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-teal-500 hover:bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {add.isPending ? 'Adding…' : 'Add edition'}
        </button>
      </div>
      {add.error && (
        <p className="text-xs text-rose-600">{add.error.message}</p>
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

function EditionMeta({ edition }: { edition: EditionRow }) {
  const bits: string[] = []
  if (edition.page_count != null) bits.push(`${edition.page_count} pages`)
  if (edition.publication_date)
    bits.push(`pub. ${formatDate(edition.publication_date)}`)

  const purchaseBits: string[] = []
  if (edition.purchase_date)
    purchaseBits.push(`bought ${formatDate(edition.purchase_date)}`)
  if (edition.purchase_location) purchaseBits.push(edition.purchase_location)
  if (edition.purchase_price != null) {
    const currency = edition.currency ?? 'AUD'
    purchaseBits.push(`${currency} ${edition.purchase_price}`)
  }
  if (edition.condition) {
    purchaseBits.push(
      edition.condition === 'second_hand' ? 'second hand' : edition.condition,
    )
  }

  if (bits.length === 0 && purchaseBits.length === 0) return null

  return (
    <div className="text-xs text-slate-500 space-y-0.5">
      {bits.length > 0 && <p>{bits.join(' · ')}</p>}
      {purchaseBits.length > 0 && <p>{purchaseBits.join(' · ')}</p>}
    </div>
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
