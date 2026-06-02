import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, type UseFormRegister, type FieldValues, type Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Search, BookPlus, Camera, BookCheck, Info, X, Plus } from 'lucide-react'
import {
  IsbnNotFoundError,
  lookupByIsbn,
  looksLikeIsbn,
  searchByTitle,
  type IsbnLookupResult,
  type TitleSearchResult,
} from '../lib/openLibrary.ts'
import {
  useAddBookFromIsbn,
  useAddBookManually,
  useBook,
  useBooks,
  useBookByWorkId,
  type EditionInput,
  type ManualBookInput,
} from '../queries/books.ts'
import { useAddEdition } from '../queries/editions.ts'
import { useStores, useAddStore } from '../queries/stores.ts'
import type { BookRow, Condition, Format } from '../lib/database.types.ts'
import { BarcodeScanner } from '../components/BarcodeScanner.tsx'
import { Cover } from '../components/Cover.tsx'

export function AddBook() {
  const [params, setParams] = useSearchParams()
  const attachId = params.get('attach')
  const [mode, setMode] = useState<'new' | 'edition'>(
    attachId ? 'edition' : 'new',
  )

  const setModeAndClearAttach = (m: 'new' | 'edition') => {
    setMode(m)
    if (m === 'new' && attachId) {
      params.delete('attach')
      setParams(params, { replace: true })
    }
  }

  return (
    <>
      <title>Add a book · Shelved</title>

      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Add a book
        </h1>
      </header>

      <div
        role="tablist"
        aria-label="What are you adding?"
        className="mb-4 inline-flex rounded-full border border-slate-200 p-1 bg-slate-100"
      >
        {(['new', 'edition'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setModeAndClearAttach(m)}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              mode === m
                ? 'bg-white shadow-sm text-slate-900 font-medium'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {m === 'new' ? 'New book' : 'Edition of existing book'}
          </button>
        ))}
      </div>

      {mode === 'new' ? (
        <AddNewBookFlow />
      ) : (
        <AddEditionFlow initialBookId={attachId} />
      )}
    </>
  )
}

// ============================================================
// Helpers shared by all flows
// ============================================================

const FORMATS = [
  'paperback',
  'hardcover',
  'ebook',
  'audiobook',
  'special_edition',
  'other',
] as const

const editionSchema = z.object({
  format: z.enum(FORMATS),
  displayName: z.string(),
  isbn: z.string(),
  isPreorder: z.boolean(),
  storeId: z.string(),
  purchaseDate: z.string(),
  purchaseLocation: z.string(),
  purchasePrice: z.string(),
  condition: z.string(),
})
type EditionFormValues = z.infer<typeof editionSchema>

const emptyEditionDefaults: EditionFormValues = {
  format: 'paperback',
  displayName: '',
  isbn: '',
  isPreorder: false,
  storeId: '',
  purchaseDate: '',
  purchaseLocation: '',
  purchasePrice: '',
  condition: '',
}

function priceToNull(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function toEditionInput(v: EditionFormValues): EditionInput {
  return {
    format: v.format as Format,
    purchaseDate: v.purchaseDate || null,
    purchaseLocation: v.purchaseLocation.trim() || null,
    purchasePrice: priceToNull(v.purchasePrice),
    condition: (v.condition || null) as Condition | null,
    displayName: v.displayName.trim() || null,
    isPreorder: v.isPreorder,
    storeId: v.storeId || null,
  }
}

// ============================================================
// New-book flow (ISBN/title lookup or manual)
// ============================================================

const lookupSchema = z.object({
  query: z.string().min(2, 'Enter an ISBN or a few words of the title'),
})
type LookupFormValues = z.infer<typeof lookupSchema>

function AddNewBookFlow() {
  const [subMode, setSubMode] = useState<'lookup' | 'manual'>('lookup')

  return (
    <>
      <div
        role="tablist"
        aria-label="How are you adding the book?"
        className="mb-4 inline-flex rounded-md border border-slate-200 p-0.5 bg-slate-100 text-xs"
      >
        {(['lookup', 'manual'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={subMode === m}
            onClick={() => setSubMode(m)}
            className={`px-2.5 py-1 rounded transition-colors ${
              subMode === m
                ? 'bg-white shadow-sm text-slate-900 font-medium'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {m === 'lookup' ? 'Look up by ISBN / title' : 'Add manually'}
          </button>
        ))}
      </div>

      {subMode === 'lookup' ? <IsbnAddFlow /> : <ManualAddFlow />}
    </>
  )
}

function IsbnAddFlow() {
  const navigate = useNavigate()
  const [coverFailed, setCoverFailed] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [forceSeparate, setForceSeparate] = useState(false)

  const lookupMutation = useMutation({
    mutationFn: (isbn: string) => lookupByIsbn(isbn),
    onSuccess: () => {
      setCoverFailed(false)
      setForceSeparate(false)
    },
  })

  const searchMutation = useMutation({
    mutationFn: (query: string) => searchByTitle(query),
  })

  const addBook = useAddBookFromIsbn()

  const lookupForm = useForm<LookupFormValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { query: '' },
  })

  const editionForm = useForm<EditionFormValues>({
    resolver: zodResolver(editionSchema),
    defaultValues: emptyEditionDefaults,
  })

  const lookup = lookupMutation.data
  const matchQuery = useBookByWorkId(lookup?.workId)
  const existingBook = matchQuery.data
  const willMerge = Boolean(existingBook && !forceSeparate)

  const onSubmit = ({ query }: LookupFormValues) => {
    const trimmed = query.trim()
    if (looksLikeIsbn(trimmed)) {
      searchMutation.reset()
      lookupMutation.mutate(trimmed)
    } else {
      lookupMutation.reset()
      searchMutation.mutate(trimmed)
    }
  }

  const pickSearchResult = (result: TitleSearchResult) => {
    searchMutation.reset()
    lookupMutation.mutate(result.isbns[0])
  }

  const onSave = async (values: EditionFormValues) => {
    if (!lookup) return
    const book = await addBook.mutateAsync({
      lookup,
      edition: toEditionInput(values),
      existingBookId: willMerge ? existingBook!.id : undefined,
    })
    navigate(`/book/${book.id}`)
  }

  return (
    <>
      <form onSubmit={lookupForm.handleSubmit(onSubmit)} className="mb-6" noValidate>
        <label htmlFor="lookup" className="block text-sm font-medium text-slate-700 mb-1">
          ISBN or title
        </label>
        <div className="flex gap-2">
          <input
            id="lookup"
            type="text"
            autoComplete="off"
            placeholder="9780141439518 or Pride and Prejudice"
            className="flex-1 min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            {...lookupForm.register('query')}
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            aria-label="Scan barcode"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={lookupMutation.isPending || searchMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-500 hover:bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">
              {lookupMutation.isPending || searchMutation.isPending ? 'Searching…' : 'Search'}
            </span>
          </button>
        </div>
        {lookupForm.formState.errors.query && (
          <p className="text-xs text-rose-600 mt-1">{lookupForm.formState.errors.query.message}</p>
        )}
        {lookupMutation.error && (
          <p className="text-xs text-rose-600 mt-1">
            {lookupMutation.error instanceof IsbnNotFoundError
              ? `No match on Open Library. Try "Add manually" above.`
              : `Lookup failed: ${lookupMutation.error.message}`}
          </p>
        )}
        {searchMutation.error && (
          <p className="text-xs text-rose-600 mt-1">
            Search failed: {searchMutation.error.message}
          </p>
        )}
      </form>

      {searchMutation.data && !lookup && (
        <SearchResults results={searchMutation.data} onPick={pickSearchResult} />
      )}

      {lookup && (
        <div className="space-y-4">
          <PreviewCard
            lookup={lookup}
            coverFailed={coverFailed}
            onCoverError={() => setCoverFailed(true)}
          />

          {existingBook && (
            <MatchBanner
              book={existingBook}
              forceSeparate={forceSeparate}
              onToggle={() => setForceSeparate((v) => !v)}
            />
          )}

          <form onSubmit={editionForm.handleSubmit(onSave)} className="space-y-3">
            <EditionFieldset register={editionForm.register} watch={editionForm.watch} />

            <button
              type="submit"
              disabled={addBook.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-500 hover:bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              <BookPlus className="h-4 w-4" />
              {addBook.isPending
                ? 'Saving…'
                : willMerge
                  ? 'Add edition to existing book'
                  : 'Add to library'}
            </button>
            {addBook.error && (
              <p className="text-xs text-rose-600">{addBook.error.message}</p>
            )}
          </form>
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false)
          lookupForm.setValue('query', code, { shouldValidate: true })
          searchMutation.reset()
          lookupMutation.mutate(code)
        }}
      />
    </>
  )
}

// ============================================================
// Manual flow (no OL lookup)
// ============================================================

const manualSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  authors: z.string().min(1, 'At least one author is required'),
  publishedYear: z.string(),
  genres: z.string(),
  description: z.string(),
  format: z.enum(FORMATS),
  isbn: z.string(),
  displayName: z.string(),
  isPreorder: z.boolean(),
  storeId: z.string(),
  purchaseDate: z.string(),
  purchaseLocation: z.string(),
  purchasePrice: z.string(),
  condition: z.string(),
})
type ManualFormValues = z.infer<typeof manualSchema>

function toManualInput(v: ManualFormValues): ManualBookInput {
  const authors = v.authors.split(',').map((s) => s.trim()).filter(Boolean)
  const genres = v.genres.split(',').map((s) => s.trim()).filter(Boolean)
  const year = v.publishedYear.trim() === '' ? null : Number(v.publishedYear)
  return {
    title: v.title.trim(),
    authors,
    publisher: null,
    publishedYear: year !== null && Number.isFinite(year) ? year : null,
    description: v.description.trim() || null,
    genres,
    edition: {
      format: v.format as Format,
      isbn: v.isbn.trim() || null,
      purchaseDate: v.purchaseDate || null,
      purchaseLocation: v.purchaseLocation.trim() || null,
      purchasePrice: priceToNull(v.purchasePrice),
      condition: (v.condition || null) as Condition | null,
      displayName: v.displayName.trim() || null,
      isPreorder: v.isPreorder,
      storeId: v.storeId || null,
    },
  }
}

function ManualAddFlow() {
  const navigate = useNavigate()
  const addManually = useAddBookManually()
  const form = useForm<ManualFormValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      title: '',
      authors: '',
      publishedYear: '',
      genres: '',
      description: '',
      format: 'paperback',
      isbn: '',
      displayName: '',
      isPreorder: false,
      storeId: '',
      purchaseDate: '',
      purchaseLocation: '',
      purchasePrice: '',
      condition: '',
    },
  })

  const onSubmit = async (values: ManualFormValues) => {
    const book = await addManually.mutateAsync(toManualInput(values))
    navigate(`/book/${book.id}`)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <FieldRow label="Title">
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...form.register('title')}
        />
        {form.formState.errors.title && (
          <p className="text-xs text-rose-600 mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </FieldRow>

      <FieldRow label="Author(s)" hint="Comma-separated for multiple">
        <input
          type="text"
          placeholder="Jane Austen"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...form.register('authors')}
        />
        {form.formState.errors.authors && (
          <p className="text-xs text-rose-600 mt-1">
            {form.formState.errors.authors.message}
          </p>
        )}
      </FieldRow>

      <FieldRow label="Published year">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="9999"
          placeholder="2003"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...form.register('publishedYear')}
        />
      </FieldRow>

      <FieldRow label="Genres" hint="Comma-separated">
        <input
          type="text"
          placeholder="Fiction, Romance, Classics"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...form.register('genres')}
        />
      </FieldRow>

      <FieldRow label="Description">
        <textarea
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...form.register('description')}
        />
      </FieldRow>

      <hr className="border-slate-200 my-4" />
      <h2 className="text-sm font-medium text-slate-700">Edition details</h2>

      <EditionFieldset register={form.register} watch={form.watch} />

      <FieldRow label="ISBN" hint="Optional — leave blank if unknown">
        <input
          type="text"
          inputMode="numeric"
          placeholder="978…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...form.register('isbn')}
        />
      </FieldRow>

      <button
        type="submit"
        disabled={addManually.isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-500 hover:bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        <BookPlus className="h-4 w-4" />
        {addManually.isPending ? 'Saving…' : 'Add to library'}
      </button>
      {addManually.error && (
        <p className="text-xs text-rose-600">{addManually.error.message}</p>
      )}
    </form>
  )
}

// ============================================================
// Edition-of-existing-book flow
// ============================================================

const editionForExistingSchema = editionSchema.extend({
  publisher: z.string(),
  publishedYear: z.string(),
  pageCount: z.string(),
})
type EditionForExistingValues = z.infer<typeof editionForExistingSchema>

function AddEditionFlow({ initialBookId }: { initialBookId: string | null }) {
  const navigate = useNavigate()
  const [bookId, setBookId] = useState<string | null>(initialBookId)
  const [scannerOpen, setScannerOpen] = useState(false)
  const { data: pickedBook } = useBook(bookId ?? undefined)
  const add = useAddEdition()

  // Optional ISBN lookup to auto-fill edition fields when attaching to
  // an existing book — just for convenience.
  const isbnLookup = useMutation({
    mutationFn: (isbn: string) => lookupByIsbn(isbn),
  })

  const form = useForm<EditionForExistingValues>({
    resolver: zodResolver(editionForExistingSchema),
    defaultValues: {
      ...emptyEditionDefaults,
      publisher: '',
      publishedYear: '',
      pageCount: '',
    },
  })

  // When the lookup succeeds, auto-fill the form fields it can populate.
  useEffect(() => {
    if (!isbnLookup.data) return
    const l = isbnLookup.data
    form.setValue('isbn', l.isbn)
    if (l.publishedYear) form.setValue('publishedYear', String(l.publishedYear))
    if (l.pageCount != null) form.setValue('pageCount', String(l.pageCount))
    if (l.publisher) form.setValue('publisher', l.publisher)
  }, [isbnLookup.data, form])

  const onSubmit = async (v: EditionForExistingValues) => {
    if (!bookId) return
    const yearTrim = v.publishedYear.trim()
    const pagesTrim = v.pageCount.trim()
    const edition = await add.mutateAsync({
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
      purchasePrice: priceToNull(v.purchasePrice),
      condition: (v.condition || null) as Condition | null,
      startedAt: null,
      finishedAt: null,
      isTrophy: false,
      storeId: v.storeId || null,
      isPreorder: v.isPreorder,
      displayName: v.displayName.trim() || null,
    })
    navigate(`/book/${edition.book_id}`)
  }

  if (!bookId) {
    return <BookPicker onPick={setBookId} />
  }

  return (
    <div className="space-y-4">
      {pickedBook && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <Cover
            path={pickedBook.cover_path}
            title={pickedBook.title}
            authors={pickedBook.authors}
            version={pickedBook.updated_at}
            className="w-14 h-20 rounded-md shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500">Adding edition to</p>
            <p className="font-semibold text-slate-900 leading-tight">
              {pickedBook.title}
            </p>
            <p className="text-sm text-slate-600 truncate">
              {pickedBook.authors.join(', ') || 'Unknown author'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBookId(null)}
            aria-label="Pick a different book"
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <p className="text-xs text-slate-600 mb-1">
          Scan or paste an ISBN to auto-fill edition details (optional).
        </p>
        <div className="flex gap-2">
          <input
            id="quick-isbn"
            type="text"
            inputMode="numeric"
            placeholder="978…"
            value={form.watch('isbn')}
            onChange={(e) => form.setValue('isbn', e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            aria-label="Scan barcode"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const isbn = form.getValues('isbn').trim()
              if (isbn) isbnLookup.mutate(isbn)
            }}
            disabled={isbnLookup.isPending || !form.watch('isbn').trim()}
            className="inline-flex items-center gap-1 rounded-md bg-slate-200 hover:bg-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
          >
            {isbnLookup.isPending ? 'Looking…' : 'Look up'}
          </button>
        </div>
        {isbnLookup.error && (
          <p className="text-xs text-rose-600">
            {isbnLookup.error instanceof IsbnNotFoundError
              ? 'No match — fill in details below manually.'
              : isbnLookup.error.message}
          </p>
        )}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <EditionFieldset register={form.register} watch={form.watch} hideIsbn />

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Publisher">
            <input
              type="text"
              {...form.register('publisher')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </FieldRow>
          <FieldRow label="Year">
            <input
              type="number"
              min="0"
              max="9999"
              {...form.register('publishedYear')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </FieldRow>
        </div>

        <FieldRow label="Pages">
          <input
            type="number"
            min="0"
            {...form.register('pageCount')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </FieldRow>

        <button
          type="submit"
          disabled={add.isPending}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-500 hover:bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          <BookPlus className="h-4 w-4" />
          {add.isPending ? 'Saving…' : 'Add edition'}
        </button>
        {add.error && (
          <p className="text-xs text-rose-600">{add.error.message}</p>
        )}
      </form>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false)
          form.setValue('isbn', code)
          isbnLookup.mutate(code)
        }}
      />
    </div>
  )
}

function BookPicker({ onPick }: { onPick: (id: string) => void }) {
  const { data: books = [], isPending } = useBooks()
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return books
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.authors.some((a) => a.toLowerCase().includes(q)),
    )
  }, [books, search])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your library by title or author"
          autoFocus
          className="w-full pl-9 pr-3 py-2.5 rounded-full border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
        />
      </div>

      {isPending && <p className="text-sm text-slate-500">Loading library…</p>}

      {books.length === 0 && !isPending && (
        <p className="text-sm text-slate-500">
          Your library's empty. Switch to "New book" to add one first.
        </p>
      )}

      {filtered.length === 0 && books.length > 0 && (
        <p className="text-sm text-slate-500">No books match "{search}".</p>
      )}

      {filtered.length > 0 && (
        <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {filtered.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onPick(b.id)}
                className="w-full flex gap-3 items-center rounded-xl border border-slate-200 bg-white p-2.5 hover:border-teal-300 hover:shadow-sm transition text-left"
              >
                <Cover
                  path={b.cover_path}
                  title={b.title}
                  authors={b.authors}
                  version={b.updated_at}
                  className="w-10 h-14 rounded-md shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {b.title}
                  </p>
                  <p className="text-xs text-slate-600 truncate">
                    {b.authors.join(', ') || 'Unknown author'}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================================
// Edition fields (shared by all flows)
// ============================================================

function EditionFieldset<T extends FieldValues>({
  register,
  watch,
  hideIsbn,
}: {
  register: UseFormRegister<T>
  watch: (name: Path<T>) => unknown
  hideIsbn?: boolean
}) {
  return (
    <div className="space-y-3">
      <FieldRow label="Format">
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          {...register('format' as Path<T>)}
        >
          <option value="paperback">Paperback</option>
          <option value="hardcover">Hardcover</option>
          <option value="ebook">eBook</option>
          <option value="audiobook">Audiobook</option>
          <option value="special_edition">Special edition</option>
          <option value="other">Other</option>
        </select>
      </FieldRow>

      <FieldRow label="Edition name" hint='Optional — e.g. "UK Hardcover"'>
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register('displayName' as Path<T>)}
        />
      </FieldRow>

      {!hideIsbn && (
        <FieldRow label="ISBN" hint="Optional">
          <input
            type="text"
            inputMode="numeric"
            placeholder="978…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register('isbn' as Path<T>)}
          />
        </FieldRow>
      )}

      <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          {...register('isPreorder' as Path<T>)}
          className="accent-teal-500"
        />
        Pre-order (haven't received it yet)
      </label>

      <StorePicker register={register} watch={watch} />

      <details className="rounded-md border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm text-slate-700">
          Purchase details (optional)
        </summary>
        <div className="p-3 pt-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Bought on">
              <input
                type="date"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...register('purchaseDate' as Path<T>)}
              />
            </FieldRow>
            <FieldRow label="Price (AUD)">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...register('purchasePrice' as Path<T>)}
              />
            </FieldRow>
          </div>
          <FieldRow label="Condition">
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              {...register('condition' as Path<T>)}
            >
              <option value="">Not set</option>
              <option value="new">New</option>
              <option value="second_hand">Second hand</option>
              <option value="unknown">Unknown</option>
            </select>
          </FieldRow>
          <FieldRow
            label="Where (free text)"
            hint="If your store isn't picked above"
          >
            <input
              type="text"
              placeholder="e.g. op-shop, gifted"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...register('purchaseLocation' as Path<T>)}
            />
          </FieldRow>
        </div>
      </details>
    </div>
  )
}

function StorePicker<T extends FieldValues>({
  register,
}: {
  register: UseFormRegister<T>
  watch: (name: Path<T>) => unknown
}) {
  const { data: stores = [] } = useStores()
  const add = useAddStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const onAdd = async () => {
    const n = name.trim()
    if (!n) {
      setAdding(false)
      return
    }
    await add.mutateAsync({ name: n })
    setName('')
    setAdding(false)
  }

  return (
    <div>
      <label className="block text-xs text-slate-600 mb-1">Store</label>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          {...register('storeId' as Path<T>)}
        >
          <option value="">Not set</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs rounded-md border border-slate-300 px-2.5 py-2 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New store name"
            autoFocus
            className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={add.isPending || !name.trim()}
            className="text-xs rounded-full bg-teal-500 hover:bg-teal-600 text-white px-2.5 py-1.5 disabled:opacity-60"
          >
            {add.isPending ? '…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setName('')
            }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Shared display components
// ============================================================

function MatchBanner({
  book,
  forceSeparate,
  onToggle,
}: {
  book: BookRow
  forceSeparate: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`flex gap-2 p-3 rounded-md text-sm ${
        forceSeparate
          ? 'border border-amber-300 bg-amber-50 text-amber-900'
          : 'border border-emerald-300 bg-emerald-50 text-emerald-900'
      }`}
    >
      {forceSeparate ? (
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
      ) : (
        <BookCheck className="h-4 w-4 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        {forceSeparate ? (
          <>
            <p>
              Adding as a <strong>separate book entry</strong>, even though you already have "
              {book.title}".
            </p>
            <button type="button" onClick={onToggle} className="mt-1 underline text-xs">
              Actually, merge under existing
            </button>
          </>
        ) : (
          <>
            <p>
              You already have <strong>{book.title}</strong> on your shelf. This will be added as a new edition under it.
            </p>
            <button type="button" onClick={onToggle} className="mt-1 underline text-xs">
              Add as a separate book instead
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function SearchResults({
  results,
  onPick,
}: {
  results: TitleSearchResult[]
  onPick: (result: TitleSearchResult) => void
}) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-slate-500 mb-4">
        No matches with an ISBN. Try a different title, or use "Add manually".
      </p>
    )
  }

  return (
    <div className="mb-6">
      <p className="text-xs text-slate-500 mb-2">
        {results.length} {results.length === 1 ? 'match' : 'matches'} — pick one
      </p>
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.workKey || r.isbns[0]}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="w-full flex gap-3 p-3 rounded-md border border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm transition text-left"
            >
              {r.coverUrl ? (
                <img
                  src={r.coverUrl}
                  alt=""
                  className="w-12 h-16 object-cover rounded shrink-0 bg-slate-100"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-12 h-16 bg-slate-100 rounded shrink-0 flex items-center justify-center text-[9px] text-slate-400">
                  No cover
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 leading-tight line-clamp-2">
                  {r.title}
                </p>
                <p className="text-xs text-slate-600 truncate">
                  {r.authors.join(', ') || 'Unknown author'}
                </p>
                {r.firstPublishYear && (
                  <p className="text-xs text-slate-400">
                    First published {r.firstPublishYear}
                  </p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PreviewCard({
  lookup,
  coverFailed,
  onCoverError,
}: {
  lookup: IsbnLookupResult
  coverFailed: boolean
  onCoverError: () => void
}) {
  return (
    <div className="flex gap-3 p-3 border border-slate-200 rounded-md bg-white">
      {lookup.coverUrl && !coverFailed ? (
        <img
          src={lookup.coverUrl}
          alt={`Cover of ${lookup.title}`}
          className="w-20 h-28 object-cover rounded shrink-0 bg-slate-100"
          onError={onCoverError}
        />
      ) : (
        <div className="w-20 h-28 bg-slate-100 rounded shrink-0 flex items-center justify-center text-xs text-slate-400">
          No cover
        </div>
      )}

      <div className="min-w-0">
        <h2 className="font-semibold leading-tight">{lookup.title}</h2>
        <p className="text-sm text-slate-600 truncate">
          {lookup.authors.join(', ') || 'Unknown author'}
        </p>
        {lookup.publishedYear && (
          <p className="text-xs text-slate-500 truncate">{lookup.publishedYear}</p>
        )}
        {lookup.pageCount != null && (
          <p className="text-xs text-slate-500">{lookup.pageCount} pages</p>
        )}
      </div>
    </div>
  )
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-600 mb-1">
        {label}
        {hint && <span className="text-slate-400 ml-1">— {hint}</span>}
      </span>
      {children}
    </label>
  )
}
