import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { downloadAndStoreCover, uploadCoverFile } from '../lib/storage.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import type { IsbnLookupResult } from '../lib/openLibrary.ts'
import type {
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
            genres: lookup.categories,
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
      })
      if (editionErr) {
        if (createdNew) {
          await supabase.from('books').delete().eq('id', book.id)
        }
        throw editionErr
      }

      // Cover only on freshly-created books — don't clobber an existing
      // one the user may have curated.
      if (createdNew && lookup.coverUrl) {
        try {
          const path = await downloadAndStoreCover(
            lookup.coverUrl,
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
  genres?: string[]
  tags?: string[]
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
    onSuccess: () => {
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
  genres: string[]
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
    mutationFn: async (input: ManualBookInput): Promise<BookRow> => {
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
          genres: input.genres,
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
      })
      if (editionErr) {
        await supabase.from('books').delete().eq('id', book.id)
        throw editionErr
      }

      return book
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: booksKey })
    },
  })
}
