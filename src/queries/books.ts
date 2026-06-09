import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { downloadAndStoreCover, uploadCoverFile } from '../lib/storage.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import type { IsbnLookupResult } from '../lib/openLibrary.ts'
import type { BulkBookRow } from '../lib/bulkImport.ts'
import type {
  Acquired,
  BookRow,
  Condition,
  Format,
  ReadingStatus,
} from '../lib/database.types.ts'

export const booksKey = ['books'] as const
export const bookKey = (id: string) => ['books', id] as const
export const bookByWorkIdKey = (workId: string) =>
  ['books', 'work', workId] as const

export function useBooks() {
  return useQuery({
    queryKey: booksKey,
    queryFn: async (): Promise<BookRow[]> => {
      const { data, error } = await supabase
        .from('books')
        .select()
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/**
 * Distinct, alphabetically-sorted values across the library, used to
 * populate the classification dropdowns (reading age / genre / sub genre /
 * mood) and the series autocomplete. Sub-genres are tracked per genre so
 * the picker can scope them to the chosen genre.
 */
export function useBookFacetValues() {
  const { data: books = [] } = useBooks()
  return useMemo(() => {
    const readingAges = new Set<string>()
    const genres = new Set<string>()
    const subGenres = new Set<string>()
    const moods = new Set<string>()
    const series = new Set<string>()
    const subByGenre = new Map<string, Set<string>>()
    for (const b of books) {
      if (b.reading_age) readingAges.add(b.reading_age)
      if (b.genre) genres.add(b.genre)
      if (b.sub_genre) subGenres.add(b.sub_genre)
      if (b.mood) moods.add(b.mood)
      if (b.series_name) series.add(b.series_name)
      if (b.genre && b.sub_genre) {
        let set = subByGenre.get(b.genre)
        if (!set) {
          set = new Set()
          subByGenre.set(b.genre, set)
        }
        set.add(b.sub_genre)
      }
    }
    const sorted = (s: Set<string>) =>
      [...s].sort((a, b) => a.localeCompare(b))
    const allSubGenres = sorted(subGenres)
    const subGenresByGenre = new Map<string, string[]>()
    for (const [g, set] of subByGenre) subGenresByGenre.set(g, sorted(set))
    return {
      readingAges: sorted(readingAges),
      genres: sorted(genres),
      subGenres: allSubGenres,
      moods: sorted(moods),
      series: sorted(series),
      /** Sub-genres used under a genre (all of them if no genre given). */
      subGenresFor: (genre: string | null) =>
        genre ? subGenresByGenre.get(genre) ?? [] : allSubGenres,
    }
  }, [books])
}

export function useBook(id: string | undefined) {
  return useQuery({
    queryKey: id ? bookKey(id) : ['books', 'none'],
    enabled: Boolean(id),
    queryFn: async (): Promise<BookRow> => {
      const { data, error } = await supabase
        .from('books')
        .select()
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })
}

/**
 * Find the user's existing book (if any) for a given Open Library Work
 * ID. Returns null when nothing matches. Used by the add flow to offer
 * "add as new edition under existing book" instead of creating a duplicate.
 */
export function useBookByWorkId(workId: string | null | undefined) {
  return useQuery({
    queryKey: workId ? bookByWorkIdKey(workId) : ['books', 'work', 'none'],
    enabled: Boolean(workId),
    queryFn: async (): Promise<BookRow | null> => {
      const { data, error } = await supabase
        .from('books')
        .select()
        .eq('openlibrary_work_id', workId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type EditionInput = {
  format: Format
  purchaseDate: string | null
  purchaseLocation: string | null
  purchasePrice: number | null
  condition: Condition | null
  displayName: string | null
  isPreorder: boolean
  storeId: string | null
  acquired: Acquired
}

export type AddBookInput = {
  lookup: IsbnLookupResult
  edition: EditionInput
  /**
   * If set, skip the books insert and just add a new edition under this
   * existing book. The caller is responsible for confirming it's actually
   * the same work (e.g. via matched workId).
   */
  existingBookId?: string
  /** Optional user-supplied cover, overriding the Open Library one. */
  coverFile?: File | null
  coverUrl?: string | null
  /** Book-level classification chosen on the add screen (new books only). */
  readingAge?: string | null
  genre?: string | null
  subGenre?: string | null
  mood?: string | null
  seriesName?: string | null
  seriesIndex?: number | null
}

/**
 * Adds a book + edition from an Open Library ISBN lookup. Two paths:
 *
 *   - existingBookId set → just insert the edition referring to that book.
 *     We don't touch the existing book's cover/metadata (deliberately —
 *     the user already curated it).
 *
 *   - new book → insert books row, then editions row. If edition fails,
 *     delete the orphan book to compensate (Supabase doesn't expose
 *     multi-statement transactions over PostgREST). Best-effort cover
 *     upload last — failure here doesn't fail the save.
 */
export function useAddBookFromIsbn() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({
      lookup,
      edition,
      existingBookId,
      coverFile,
      coverUrl,
      readingAge,
      genre,
      subGenre,
      mood,
      seriesName,
      seriesIndex,
    }: AddBookInput): Promise<BookRow> => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      let book: BookRow
      const createdNew = !existingBookId

      if (existingBookId) {
        const { data, error } = await supabase
          .from('books')
          .select()
          .eq('id', existingBookId)
          .single()
        if (error) throw error
        book = data
      } else {
        const { data, error } = await supabase
          .from('books')
          .insert({
            user_id: userId,
            title: lookup.title,
            authors: lookup.authors,
            publisher: lookup.publisher,
            published_year: lookup.publishedYear,
            description: lookup.description,
            reading_age: readingAge ?? null,
            genre: genre ?? null,
            sub_genre: subGenre ?? null,
            mood: mood ?? null,
            series_name: seriesName ?? null,
            series_index: seriesIndex ?? null,
            openlibrary_work_id: lookup.workId,
          })
          .select()
          .single()
        if (error) throw error
        book = data
      }

      const { error: editionErr } = await supabase.from('editions').insert({
        user_id: userId,
        book_id: book.id,
        format: edition.format,
        isbn: lookup.isbn,
        publisher: lookup.publisher,
        page_count: lookup.pageCount,
        publication_date: lookup.publishedYear
          ? `${lookup.publishedYear}-01-01`
          : null,
        purchase_date: edition.purchaseDate,
        purchase_location: edition.purchaseLocation,
        purchase_price: edition.purchasePrice,
        condition: edition.condition,
        display_name: edition.displayName,
        is_preorder: edition.isPreorder,
        store_id: edition.storeId,
        acquired: edition.acquired,
        currency: 'NZD',
      })
      if (editionErr) {
        if (createdNew) {
          await supabase.from('books').delete().eq('id', book.id)
        }
        throw editionErr
      }

      // Cover only on freshly-created books — don't clobber an existing
      // one the user may have curated. Prefer a user-supplied image,
      // falling back to the Open Library cover.
      if (createdNew) {
        try {
          let path: string | null = null
          if (coverFile) {
            path = await uploadCoverFile(coverFile, userId, book.id)
          } else if (coverUrl) {
            path = await downloadAndStoreCover(coverUrl, userId, book.id)
          } else if (lookup.coverUrl) {
            path = await downloadAndStoreCover(lookup.coverUrl, userId, book.id)
          }
          if (path) {
            const { data: updated } = await supabase
              .from('books')
              .update({ cover_path: path })
              .eq('id', book.id)
              .select()
              .single()
            if (updated) return updated
          }
        } catch (err) {
          console.warn('Cover upload failed (continuing):', err)
        }
      }

      return book
    },
    onSuccess: (book) => {
      qc.invalidateQueries({ queryKey: booksKey })
      qc.invalidateQueries({ queryKey: bookKey(book.id) })
      if (book.openlibrary_work_id) {
        qc.invalidateQueries({
          queryKey: bookByWorkIdKey(book.openlibrary_work_id),
        })
      }
    },
  })
}

/**
 * Replace a book's cover with an image fetched from an arbitrary URL.
 * Same storage path as the OL-fetched cover (uses `upsert`), so this
 * also doubles as a way to override a bad auto-fetched cover.
 *
 * CORS: fetch will fail for image hosts that don't serve cross-origin
 * headers. The mutation surfaces that error to the UI so the user
 * knows to try a different URL.
 */
/** Replace a book's cover with a file picked from the user's device. */
export function useSetCoverFromFile(bookId: string) {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (file: File): Promise<BookRow> => {
      if (!session) throw new Error('Not signed in')
      const path = await uploadCoverFile(file, session.user.id, bookId)
      const { data, error } = await supabase
        .from('books')
        .update({ cover_path: path })
        .eq('id', bookId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookKey(bookId) })
      qc.invalidateQueries({ queryKey: booksKey })
    },
  })
}

export function useSetCoverFromUrl(bookId: string) {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (url: string): Promise<BookRow> => {
      if (!session) throw new Error('Not signed in')
      const path = await downloadAndStoreCover(url, session.user.id, bookId)
      const { data, error } = await supabase
        .from('books')
        .update({ cover_path: path })
        .eq('id', bookId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookKey(bookId) })
      qc.invalidateQueries({ queryKey: booksKey })
    },
  })
}

export type BookMetadataUpdate = {
  title?: string
  authors?: string[]
  publisher?: string | null
  published_year?: number | null
  description?: string | null
  reading_age?: string | null
  genre?: string | null
  sub_genre?: string | null
  mood?: string | null
  series_name?: string | null
  series_index?: number | null
  rating?: number | null
}

/**
 * Set a book's reading status and keep TBR list-items in sync.
 *
 * 'want_to_read' → ensure the book is on the TBR pool (if not already
 *                  on top). All other statuses → remove from TBR.
 *
 * We don't touch edition.started_at / finished_at — those will become
 * a v2 "log a reading session" feature.
 */
export function useUpdateReadingStatus(bookId: string) {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (status: ReadingStatus | null) => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      const { error: updErr } = await supabase
        .from('books')
        .update({ reading_status: status })
        .eq('id', bookId)
      if (updErr) throw updErr

      if (status === 'want_to_read') {
        const { data: existing } = await supabase
          .from('list_items')
          .select('id, list_kind')
          .eq('book_id', bookId)
          .in('list_kind', ['tbr_top', 'tbr_pool'])
          .maybeSingle()
        if (!existing) {
          const { error } = await supabase.from('list_items').insert({
            user_id: userId,
            book_id: bookId,
            list_kind: 'tbr_pool',
          })
          if (error) throw error
        }
      } else {
        const { error } = await supabase
          .from('list_items')
          .delete()
          .eq('book_id', bookId)
          .in('list_kind', ['tbr_top', 'tbr_pool'])
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookKey(bookId) })
      qc.invalidateQueries({ queryKey: booksKey })
      qc.invalidateQueries({ queryKey: ['lists', 'tbr'] })
      qc.invalidateQueries({ queryKey: ['lists', 'tbr_top_ids'] })
      qc.invalidateQueries({ queryKey: ['list_items', 'book', bookId] })
    },
  })
}

/** Edit book metadata (title, author, publisher, etc.) in place. */
export function useUpdateBook(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (update: BookMetadataUpdate): Promise<BookRow> => {
      const { data, error } = await supabase
        .from('books')
        .update(update)
        .eq('id', bookId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    // Apply the change to the cache immediately (e.g. tag chips, rating,
    // category) so the UI updates without waiting on the round-trip.
    onMutate: async (update) => {
      await qc.cancelQueries({ queryKey: bookKey(bookId) })
      await qc.cancelQueries({ queryKey: booksKey })
      const prevBook = qc.getQueryData<BookRow>(bookKey(bookId))
      const prevBooks = qc.getQueryData<BookRow[]>(booksKey)
      if (prevBook) {
        qc.setQueryData<BookRow>(bookKey(bookId), { ...prevBook, ...update })
      }
      if (prevBooks) {
        qc.setQueryData<BookRow[]>(
          booksKey,
          prevBooks.map((b) => (b.id === bookId ? { ...b, ...update } : b)),
        )
      }
      return { prevBook, prevBooks }
    },
    // Roll back the optimistic change if the save fails.
    onError: (_err, _update, context) => {
      if (context?.prevBook) qc.setQueryData(bookKey(bookId), context.prevBook)
      if (context?.prevBooks) qc.setQueryData(booksKey, context.prevBooks)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bookKey(bookId) })
      qc.invalidateQueries({ queryKey: booksKey })
    },
  })
}

/**
 * Delete a book entirely. The schema's ON DELETE CASCADE handles
 * editions, notes, quotes, bookmarks, list_items in one row delete.
 * Storage cleanup (book cover + per-edition covers under the book
 * folder) is best-effort — failures don't block the row delete since
 * orphan files in a public bucket aren't a security issue.
 */
export function useDeleteBook() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (bookId: string): Promise<void> => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      // Best-effort storage cleanup.
      try {
        await supabase.storage
          .from('covers')
          .remove([`${userId}/${bookId}.jpg`])
        const { data: files } = await supabase.storage
          .from('covers')
          .list(`${userId}/${bookId}`)
        if (files && files.length > 0) {
          await supabase.storage
            .from('covers')
            .remove(files.map((f) => `${userId}/${bookId}/${f.name}`))
        }
      } catch {
        // Storage cleanup failures don't block the delete.
      }

      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId)
      if (error) throw error
    },
    onSuccess: (_data, bookId) => {
      qc.invalidateQueries({ queryKey: booksKey })
      qc.invalidateQueries({ queryKey: bookKey(bookId) })
      qc.invalidateQueries({ queryKey: ['editions', 'counts'] })
    },
  })
}

export type ManualBookInput = {
  title: string
  authors: string[]
  publisher: string | null
  publishedYear: number | null
  description: string | null
  readingAge: string | null
  genre: string | null
  subGenre: string | null
  mood: string | null
  seriesName: string | null
  seriesIndex: number | null
  edition: EditionInput & { isbn: string | null }
}

/**
 * Adds a manually-entered book + first edition. Used when Open Library
 * doesn't have the ISBN, or when there's no ISBN at all (op-shop find,
 * special edition with broken barcode, etc.).
 *
 * Same atomicity dance as useAddBookFromIsbn: if the edition insert
 * fails, the just-created book is deleted to avoid an orphan.
 */
export function useAddBookManually() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async (input: ManualBookInputWithCover): Promise<BookRow> => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      const { data: book, error: bookErr } = await supabase
        .from('books')
        .insert({
          user_id: userId,
          title: input.title,
          authors: input.authors,
          publisher: input.publisher,
          published_year: input.publishedYear,
          description: input.description,
          reading_age: input.readingAge,
          genre: input.genre,
          sub_genre: input.subGenre,
          mood: input.mood,
          series_name: input.seriesName,
          series_index: input.seriesIndex,
        })
        .select()
        .single()
      if (bookErr) throw bookErr

      const { error: editionErr } = await supabase.from('editions').insert({
        user_id: userId,
        book_id: book.id,
        format: input.edition.format,
        isbn: input.edition.isbn,
        publisher: input.publisher,
        publication_date: input.publishedYear
          ? `${input.publishedYear}-01-01`
          : null,
        purchase_date: input.edition.purchaseDate,
        purchase_location: input.edition.purchaseLocation,
        purchase_price: input.edition.purchasePrice,
        condition: input.edition.condition,
        display_name: input.edition.displayName,
        is_preorder: input.edition.isPreorder,
        store_id: input.edition.storeId,
        acquired: input.edition.acquired,
        currency: 'NZD',
      })
      if (editionErr) {
        await supabase.from('books').delete().eq('id', book.id)
        throw editionErr
      }

      try {
        if (input.coverFile) {
          const path = await uploadCoverFile(input.coverFile, userId, book.id)
          const { data: updated } = await supabase
            .from('books')
            .update({ cover_path: path })
            .eq('id', book.id)
            .select()
            .single()
          if (updated) return updated
        } else if (input.coverUrl?.trim()) {
          const path = await downloadAndStoreCover(
            input.coverUrl.trim(),
            userId,
            book.id,
          )
          const { data: updated } = await supabase
            .from('books')
            .update({ cover_path: path })
            .eq('id', book.id)
            .select()
            .single()
          if (updated) return updated
        }
      } catch (err) {
        console.warn('Cover upload failed (continuing):', err)
      }

      return book
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: booksKey })
    },
  })
}

export type ManualBookInputWithCover = ManualBookInput & {
  coverFile?: File | null
  coverUrl?: string | null
}

export type BulkAddResultItem = {
  row: BulkBookRow
  ok: boolean
  bookId?: string
  error?: string
}

/**
 * Temporary bulk import: one paperback edition per row (ISBN/title/authors only).
 * Processes rows sequentially so failures don't block the rest.
 */
export function useBulkAddBooks() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async (rows: BulkBookRow[]): Promise<BulkAddResultItem[]> => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id
      const results: BulkAddResultItem[] = []

      for (const row of rows) {
        try {
          const { data: book, error: bookErr } = await supabase
            .from('books')
            .insert({
              user_id: userId,
              title: row.title,
              authors: row.authors,
              publisher: null,
              published_year: null,
              description: null,
            })
            .select()
            .single()
          if (bookErr) throw bookErr

          const { error: editionErr } = await supabase.from('editions').insert({
            user_id: userId,
            book_id: book.id,
            format: 'paperback' as Format,
            isbn: row.isbn,
            currency: 'NZD',
          })
          if (editionErr) {
            await supabase.from('books').delete().eq('id', book.id)
            throw editionErr
          }

          results.push({ row, ok: true, bookId: book.id })
        } catch (err) {
          results.push({
            row,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      return results
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: booksKey })
      qc.invalidateQueries({ queryKey: ['editions'] })
    },
  })
}
