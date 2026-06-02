import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { uploadEditionCoverFile } from '../lib/storage.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { bookKey, booksKey } from './books.ts'
import type {
  Condition,
  EditionRow,
  Format,
} from '../lib/database.types.ts'

export const editionsByBookKey = (bookId: string) =>
  ['editions', 'book', bookId] as const

export const editionCountsKey = ['editions', 'counts'] as const

/**
 * Count of editions per book, fetched in a single query and bucketed
 * client-side. Cheap enough for ~1000 books × a few editions each
 * (a few thousand rows max). When the library gets bigger we can move
 * this to a Postgres view + a single RPC call.
 */
export type NewEditionInput = {
  bookId: string
  format: Format
  isbn: string | null
  publisher: string | null
  publicationYear: number | null
  pageCount: number | null
  durationSeconds: number | null
  purchaseDate: string | null
  purchaseLocation: string | null
  purchasePrice: number | null
  condition: Condition | null
  startedAt: string | null
  finishedAt: string | null
  isTrophy: boolean
  storeId: string | null
  isPreorder: boolean
  displayName: string | null
}

/** Add a new edition under an existing book. */
export function useAddEdition() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (input: NewEditionInput): Promise<EditionRow> => {
      if (!session) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('editions')
        .insert({
          user_id: session.user.id,
          book_id: input.bookId,
          format: input.format,
          isbn: input.isbn,
          publisher: input.publisher,
          publication_date: input.publicationYear
            ? `${input.publicationYear}-01-01`
            : null,
          page_count: input.pageCount,
          duration_seconds: input.durationSeconds,
          purchase_date: input.purchaseDate,
          purchase_location: input.purchaseLocation,
          purchase_price: input.purchasePrice,
          condition: input.condition,
          started_at: input.startedAt,
          finished_at: input.finishedAt,
          is_trophy: input.isTrophy,
          store_id: input.storeId,
          is_preorder: input.isPreorder,
          display_name: input.displayName,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (edition) => {
      qc.invalidateQueries({ queryKey: editionsByBookKey(edition.book_id) })
      qc.invalidateQueries({ queryKey: ['editions', 'counts'] })
      qc.invalidateQueries({ queryKey: bookKey(edition.book_id) })
      qc.invalidateQueries({ queryKey: booksKey })
    },
  })
}

/** Upload a file as a specific edition's cover. */
export function useSetEditionCoverFromFile(editionId: string, bookId: string) {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (file: File): Promise<EditionRow> => {
      if (!session) throw new Error('Not signed in')
      const path = await uploadEditionCoverFile(
        file,
        session.user.id,
        bookId,
        editionId,
      )
      const { data, error } = await supabase
        .from('editions')
        .update({ cover_path: path })
        .eq('id', editionId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (edition) => {
      qc.invalidateQueries({ queryKey: editionsByBookKey(edition.book_id) })
    },
  })
}

/** Update started/finished dates on an edition. Pass null to clear. */
export function useUpdateEditionDates(editionId: string, bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      started_at: string | null
      finished_at: string | null
    }) => {
      const { error } = await supabase
        .from('editions')
        .update(input)
        .eq('id', editionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: editionsByBookKey(bookId) })
    },
  })
}

/** Clear an edition's cover (falls back to book cover). */
export function useClearEditionCover(editionId: string, bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase
        .from('editions')
        .update({ cover_path: null })
        .eq('id', editionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: editionsByBookKey(bookId) })
    },
  })
}

/**
 * Delete a single edition. Does NOT cascade to the parent book — if
 * the user deletes the last edition of a book, the book row stays
 * (just becomes "no editions"). Up to them to clean up.
 */
export function useDeleteEdition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (editionId: string) => {
      const { error } = await supabase
        .from('editions')
        .delete()
        .eq('id', editionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['editions'] })
    },
  })
}

export function useEditionCounts() {
  return useQuery({
    queryKey: editionCountsKey,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('editions')
        .select('book_id')
      if (error) throw error
      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        counts.set(row.book_id, (counts.get(row.book_id) ?? 0) + 1)
      }
      return counts
    },
  })
}

export type EditionStatus = 'read' | 'reading' | null

export type EditionSummary = {
  count: number
  status: EditionStatus
  /** True if any edition of this book is audio-formatted. */
  hasAudiobook: boolean
  /** Distinct formats owned for this book — used for per-format icons. */
  formats: Set<Format>
}

export const editionSummariesKey = ['editions', 'summaries'] as const

/**
 * Richer per-book summary used by the bookcase: edition count + reading
 * status (trophy and finished_at both count as "read"; started without
 * finished = "reading"). One query, derived client-side.
 */
export function useEditionSummaries() {
  return useQuery({
    queryKey: editionSummariesKey,
    queryFn: async (): Promise<Map<string, EditionSummary>> => {
      const { data, error } = await supabase
        .from('editions')
        .select('book_id, format, started_at, finished_at, is_trophy')
      if (error) throw error

      const map = new Map<string, EditionSummary>()
      for (const row of data ?? []) {
        const cur = map.get(row.book_id) ?? {
          count: 0,
          status: null as EditionStatus,
          hasAudiobook: false,
          formats: new Set<Format>(),
        }
        cur.count += 1
        cur.formats.add(row.format)
        const isRead = Boolean(row.finished_at || row.is_trophy)
        const isReading = Boolean(row.started_at && !row.finished_at)
        // Reading wins over read in our display priority.
        if (isReading) cur.status = 'reading'
        else if (isRead && cur.status !== 'reading') cur.status = 'read'
        if (row.format === 'audiobook') cur.hasAudiobook = true
        map.set(row.book_id, cur)
      }
      return map
    },
  })
}

/** Toggle the `is_trophy` flag on an edition. */
export function useUpdateEditionTrophy(editionId: string, bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (isTrophy: boolean) => {
      const { error } = await supabase
        .from('editions')
        .update({ is_trophy: isTrophy })
        .eq('id', editionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: editionsByBookKey(bookId) })
      qc.invalidateQueries({ queryKey: editionSummariesKey })
    },
  })
}

export function useEditions(bookId: string | undefined) {
  return useQuery({
    queryKey: bookId ? editionsByBookKey(bookId) : ['editions', 'none'],
    enabled: Boolean(bookId),
    queryFn: async (): Promise<EditionRow[]> => {
      const { data, error } = await supabase
        .from('editions')
        .select()
        .eq('book_id', bookId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}
