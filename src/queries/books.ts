import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { downloadAndStoreCover } from '../lib/storage.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import type { IsbnLookupResult } from '../lib/openLibrary.ts'
import type { BookRow, Condition, Format } from '../lib/database.types.ts'

export const booksKey = ['books'] as const
export const bookKey = (id: string) => ['books', id] as const

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

export type EditionInput = {
  format: Format
  purchaseDate: string | null
  purchaseLocation: string | null
  purchasePrice: number | null
  condition: Condition | null
}

export type AddBookInput = {
  lookup: IsbnLookupResult
  edition: EditionInput
}

/**
 * Adds a book + its first edition to the library, in this order:
 *   1. insert books row (no cover_path yet)
 *   2. insert editions row referring to that book
 *      (if it fails, delete the orphan books row to compensate —
 *       Supabase doesn't expose multi-statement transactions over
 *       PostgREST, so we manage atomicity by hand)
 *   3. best-effort: download cover from Open Library, upload to
 *      Storage, update books.cover_path. Failure here doesn't fail
 *      the whole save — you can always add a cover later.
 */
export function useAddBookFromIsbn() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({ lookup, edition }: AddBookInput): Promise<BookRow> => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      // 1. Insert the book.
      const { data: book, error: bookErr } = await supabase
        .from('books')
        .insert({
          user_id: userId,
          title: lookup.title,
          authors: lookup.authors,
          publisher: lookup.publisher,
          published_year: lookup.publishedYear,
          description: lookup.description,
          genres: lookup.categories,
        })
        .select()
        .single()
      if (bookErr) throw bookErr

      // 2. Insert the first edition. Roll back the book on failure.
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
      })
      if (editionErr) {
        await supabase.from('books').delete().eq('id', book.id)
        throw editionErr
      }

      // 3. Best-effort cover upload.
      if (lookup.coverUrl) {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: booksKey })
    },
  })
}
