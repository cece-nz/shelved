import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type UseFormRegister, type FieldValues, type Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Search, BookPlus, Camera, BookCheck, Info } from 'lucide-react'
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
  useBookByWorkId,
  type EditionInput,
  type ManualBookInput,
} from '../queries/books.ts'
import type { BookRow, Condition, Format } from '../lib/database.types.ts'
import { BarcodeScanner } from '../components/BarcodeScanner.tsx'

export function AddBook() {
  const [mode, setMode] = useState<'lookup' | 'manual'>('lookup')

  return (
    <>
      <title>Add a book · Shelved</title>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Add a book</h1>
      </header>

      <div
        role="tablist"
        aria-label="Add method"
        className="mb-4 inline-flex rounded-md border border-slate-200 p-1 bg-slate-100"
      >
        {(['lookup', 'manual'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              mode === m
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {m === 'lookup' ? 'Look up by ISBN' : 'Add manually'}
          </button>
        ))}
      </div>

      {mode === 'lookup' ? <IsbnAddFlow /> : <ManualAddFlow />}
    </>
  )
}

// ============================================================
// ISBN lookup flow
// ============================================================

const lookupSchema = z.object({
  query: z.string().min(2, 'Enter an ISBN or a few words of the title'),
})
type LookupFormValues = z.infer<typeof lookupSchema>

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
    // Hand the chosen result's primary ISBN to the regular lookup so we
    // get description, work-id, cover, dedup, etc. for free.
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
              {lookupMutation.isPending || searchMutation.isPending
                ? 'Searching…'
                : 'Search'}
            </span>
          </button>
        </div>
        {lookupForm.formState.errors.query && (
          <p className="text-xs text-rose-600 mt-1">
            {lookupForm.formState.errors.query.message}
          </p>
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
        <SearchResults
          results={searchMutation.data}
          onPick={pickSearchResult}
        />
      )}

      {lookup && (
        <div className="space-y-4">
          <PreviewCard
            lookup={lookup}
            coverFailed={coverFailed}
            onCoverError={() => setCoverFailed(true)}
          />

          {existingBook && <MatchBanner book={existingBook} forceSeparate={forceSeparate} onToggle={() => setForceSeparate((v) => !v)} />}

          <form onSubmit={editionForm.handleSubmit(onSave)} className="space-y-3">
            <FormatField register={editionForm.register} name="format" />
            <PurchaseDetails register={editionForm.register} />

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
      {forceSeparate ? <Info className="h-4 w-4 shrink-0 mt-0.5" /> : <BookCheck className="h-4 w-4 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        {forceSeparate ? (
          <>
            <p>Adding as a <strong>separate book entry</strong>, even though you already have "{book.title}".</p>
            <button type="button" onClick={onToggle} className="mt-1 underline text-xs">
              Actually, merge under existing
            </button>
          </>
        ) : (
          <>
            <p>You already have <strong>{book.title}</strong> on your shelf. This will be added as a new edition under it.</p>
            <button type="button" onClick={onToggle} className="mt-1 underline text-xs">
              Add as a separate book instead
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Manual add flow
// ============================================================

const manualSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  authors: z.string().min(1, 'At least one author is required'),
  publisher: z.string(),
  publishedYear: z.string(),
  genres: z.string(),
  description: z.string(),
  format: z.enum([
    'paperback',
    'hardcover',
    'ebook',
    'audiobook',
    'special_edition',
    'other',
  ]),
  isbn: z.string(),
  purchaseDate: z.string(),
  purchaseLocation: z.string(),
  purchasePrice: z.string(),
  condition: z.string(),
})
type ManualFormValues = z.infer<typeof manualSchema>

function ManualAddFlow() {
  const navigate = useNavigate()
  const addManually = useAddBookManually()

  const form = useForm<ManualFormValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      title: '',
      authors: '',
      publisher: '',
      publishedYear: '',
      genres: '',
      description: '',
      format: 'paperback',
      isbn: '',
      ...emptyPurchaseDefaults,
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

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Publisher">
          <input
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...form.register('publisher')}
          />
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
      </div>

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

      <FormatField register={form.register} name="format" />

      <FieldRow label="ISBN" hint="Optional — leave blank if unknown or unscannable">
        <input
          type="text"
          inputMode="numeric"
          placeholder="978…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...form.register('isbn')}
        />
      </FieldRow>

      <PurchaseDetails register={form.register} />

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
// Shared subcomponents + form helpers
// ============================================================

const editionSchema = z.object({
  format: z.enum([
    'paperback',
    'hardcover',
    'ebook',
    'audiobook',
    'special_edition',
    'other',
  ]),
  purchaseDate: z.string(),
  purchaseLocation: z.string(),
  purchasePrice: z.string(),
  condition: z.string(),
})
type EditionFormValues = z.infer<typeof editionSchema>

const emptyPurchaseDefaults = {
  purchaseDate: '',
  purchaseLocation: '',
  purchasePrice: '',
  condition: '',
} as const

const emptyEditionDefaults: EditionFormValues = {
  format: 'paperback',
  ...emptyPurchaseDefaults,
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
  }
}

function toManualInput(v: ManualFormValues): ManualBookInput {
  const authors = v.authors
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const genres = v.genres
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const year = v.publishedYear.trim() === '' ? null : Number(v.publishedYear)
  return {
    title: v.title.trim(),
    authors,
    publisher: v.publisher.trim() || null,
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
    },
  }
}

// react-hook-form's `register` is generic over the form's field values;
// these little wrapper components are generic too so they can be reused
// in both flows without losing type safety.
function FormatField<T extends FieldValues>({
  register,
  name,
}: {
  register: UseFormRegister<T>
  name: Path<T>
}) {
  return (
    <FieldRow label="Format">
      <select
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
        {...register(name)}
      >
        <option value="paperback">Paperback</option>
        <option value="hardcover">Hardcover</option>
        <option value="ebook">eBook</option>
        <option value="audiobook">Audiobook</option>
        <option value="special_edition">Special edition</option>
        <option value="other">Other</option>
      </select>
    </FieldRow>
  )
}

function PurchaseDetails<T extends FieldValues>({
  register,
}: {
  register: UseFormRegister<T>
}) {
  return (
    <details className="rounded-md border border-slate-200 bg-white">
      <summary className="cursor-pointer px-3 py-2 text-sm text-slate-700">
        Purchase details (optional)
      </summary>
      <div className="p-3 pt-0 space-y-2">
        <FieldRow label="Purchased on">
          <input
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register('purchaseDate' as Path<T>)}
          />
        </FieldRow>
        <FieldRow label="Where">
          <input
            type="text"
            placeholder="e.g. Readings Carlton, op-shop, Amazon"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register('purchaseLocation' as Path<T>)}
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
      </div>
    </details>
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
        {(lookup.publisher || lookup.publishedYear) && (
          <p className="text-xs text-slate-500 truncate">
            {[lookup.publisher, lookup.publishedYear].filter(Boolean).join(' · ')}
          </p>
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
