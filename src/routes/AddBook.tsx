import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Search, BookPlus, Camera } from 'lucide-react'
import {
  IsbnNotFoundError,
  lookupByIsbn,
  type IsbnLookupResult,
} from '../lib/openLibrary.ts'
import { useAddBookFromIsbn, type EditionInput } from '../queries/books.ts'
import type { Condition, Format } from '../lib/database.types.ts'
import { BarcodeScanner } from '../components/BarcodeScanner.tsx'

const isbnSchema = z.object({
  isbn: z
    .string()
    .min(10, 'ISBN looks too short')
    .max(20, 'ISBN looks too long')
    .regex(/^[0-9Xx\-\s]+$/, 'ISBN can only contain digits, X, hyphens, spaces'),
})

type IsbnFormValues = z.infer<typeof isbnSchema>

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

function toEditionInput(v: EditionFormValues): EditionInput {
  const trimmedPrice = v.purchasePrice.trim()
  const price = trimmedPrice === '' ? null : Number(trimmedPrice)
  return {
    format: v.format as Format,
    purchaseDate: v.purchaseDate || null,
    purchaseLocation: v.purchaseLocation.trim() || null,
    purchasePrice: price !== null && Number.isFinite(price) ? price : null,
    condition: (v.condition || null) as Condition | null,
  }
}

export function AddBook() {
  const navigate = useNavigate()
  const [coverFailed, setCoverFailed] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  const lookupMutation = useMutation({
    mutationFn: (isbn: string) => lookupByIsbn(isbn),
    onSuccess: () => setCoverFailed(false),
  })

  const addBook = useAddBookFromIsbn()

  const isbnForm = useForm<IsbnFormValues>({
    resolver: zodResolver(isbnSchema),
    defaultValues: { isbn: '' },
  })

  const editionForm = useForm<EditionFormValues>({
    resolver: zodResolver(editionSchema),
    defaultValues: {
      format: 'paperback',
      purchaseDate: '',
      purchaseLocation: '',
      purchasePrice: '',
      condition: '',
    },
  })

  const lookup = lookupMutation.data

  const onLookup = ({ isbn }: IsbnFormValues) => {
    lookupMutation.mutate(isbn)
  }

  const onSave = async (values: EditionFormValues) => {
    if (!lookup) return
    const book = await addBook.mutateAsync({
      lookup,
      edition: toEditionInput(values),
    })
    navigate(`/book/${book.id}`)
  }

  return (
    <>
      <title>Add a book · Shelved</title>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Add a book</h1>
        <p className="text-sm text-stone-500">
          Enter an ISBN and we'll pull details from Open Library.
        </p>
      </header>

      <form
        onSubmit={isbnForm.handleSubmit(onLookup)}
        className="mb-6"
        noValidate
      >
        <label
          htmlFor="isbn"
          className="block text-sm font-medium text-stone-700 mb-1"
        >
          ISBN
        </label>
        <div className="flex gap-2">
          <input
            id="isbn"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="9780141439518"
            className="flex-1 min-w-0 rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
            {...isbnForm.register('isbn')}
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            aria-label="Scan barcode"
            className="inline-flex items-center justify-center rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={lookupMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">
              {lookupMutation.isPending ? 'Looking up…' : 'Look up'}
            </span>
          </button>
        </div>
        {isbnForm.formState.errors.isbn && (
          <p className="text-xs text-red-600 mt-1">
            {isbnForm.formState.errors.isbn.message}
          </p>
        )}
        {lookupMutation.error && (
          <p className="text-xs text-red-600 mt-1">
            {lookupMutation.error instanceof IsbnNotFoundError
              ? `No book found for that ISBN on Open Library. You can still add it manually below — coming soon.`
              : `Lookup failed: ${lookupMutation.error.message}`}
          </p>
        )}
      </form>

      {lookup && (
        <div className="space-y-4">
          <PreviewCard
            lookup={lookup}
            coverFailed={coverFailed}
            onCoverError={() => setCoverFailed(true)}
          />

          <form onSubmit={editionForm.handleSubmit(onSave)} className="space-y-3">
            <div>
              <label
                htmlFor="format"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Format
              </label>
              <select
                id="format"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm bg-white"
                {...editionForm.register('format')}
              >
                <option value="paperback">Paperback</option>
                <option value="hardcover">Hardcover</option>
                <option value="ebook">eBook</option>
                <option value="audiobook">Audiobook</option>
                <option value="special_edition">Special edition</option>
                <option value="other">Other</option>
              </select>
            </div>

            <details className="rounded-md border border-stone-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-sm text-stone-700">
                Purchase details (optional)
              </summary>
              <div className="p-3 pt-0 space-y-2">
                <FieldRow label="Purchased on">
                  <input
                    type="date"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                    {...editionForm.register('purchaseDate')}
                  />
                </FieldRow>
                <FieldRow label="Where">
                  <input
                    type="text"
                    placeholder="e.g. Readings Carlton, op-shop, Amazon"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                    {...editionForm.register('purchaseLocation')}
                  />
                </FieldRow>
                <FieldRow label="Price (AUD)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                    {...editionForm.register('purchasePrice')}
                  />
                </FieldRow>
                <FieldRow label="Condition">
                  <select
                    className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm bg-white"
                    {...editionForm.register('condition')}
                  >
                    <option value="">Not set</option>
                    <option value="new">New</option>
                    <option value="second_hand">Second hand</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </FieldRow>
              </div>
            </details>

            <button
              type="submit"
              disabled={addBook.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              <BookPlus className="h-4 w-4" />
              {addBook.isPending ? 'Saving…' : 'Add to library'}
            </button>
            {addBook.error && (
              <p className="text-xs text-red-600">{addBook.error.message}</p>
            )}
          </form>
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false)
          isbnForm.setValue('isbn', code, { shouldValidate: true })
          lookupMutation.mutate(code)
        }}
      />
    </>
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
    <div className="flex gap-3 p-3 border border-stone-200 rounded-md bg-white">
      {lookup.coverUrl && !coverFailed ? (
        <img
          src={lookup.coverUrl}
          alt={`Cover of ${lookup.title}`}
          className="w-20 h-28 object-cover rounded shrink-0 bg-stone-100"
          onError={onCoverError}
        />
      ) : (
        <div className="w-20 h-28 bg-stone-100 rounded shrink-0 flex items-center justify-center text-xs text-stone-400">
          No cover
        </div>
      )}

      <div className="min-w-0">
        <h2 className="font-semibold leading-tight">{lookup.title}</h2>
        <p className="text-sm text-stone-600 truncate">
          {lookup.authors.join(', ') || 'Unknown author'}
        </p>
        {(lookup.publisher || lookup.publishedYear) && (
          <p className="text-xs text-stone-500 truncate">
            {[lookup.publisher, lookup.publishedYear]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {lookup.pageCount != null && (
          <p className="text-xs text-stone-500">{lookup.pageCount} pages</p>
        )}
      </div>
    </div>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs text-stone-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
