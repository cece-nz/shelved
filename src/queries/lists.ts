import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import type {
  BookRow,
  ListItemRow,
  ListKind,
} from '../lib/database.types.ts'

export const tbrKey = ['lists', 'tbr'] as const
export const tbrTopIdsKey = ['lists', 'tbr_top_ids'] as const
export const listMembershipKey = (bookId: string) =>
  ['list_items', 'book', bookId] as const

/** Lightweight: just the set of book IDs on the TBR top list. */
export function useTbrTopBookIds() {
  return useQuery({
    queryKey: tbrTopIdsKey,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('list_items')
        .select('book_id')
        .eq('list_kind', 'tbr_top')
      if (error) throw error
      return new Set((data ?? []).map((r) => r.book_id))
    },
  })
}

const TBR_MAX_TOP = 10

export type TbrEntry = { item: ListItemRow; book: BookRow }
export type TbrData = { top: TbrEntry[]; pool: TbrEntry[] }

/**
 * Fetch all TBR list items and the books they reference, in two
 * queries (we'd use a single nested select but our hand-written
 * Database types don't model the foreign-key relationships yet, so
 * Supabase's nested-select type inference doesn't carry through).
 *
 * Returns:
 *   top  — items in `tbr_top`, sorted by their `position` field
 *   pool — items in `tbr_pool`, sorted by creation time (oldest first)
 */
export function useTbrBooks() {
  return useQuery({
    queryKey: tbrKey,
    queryFn: async (): Promise<TbrData> => {
      const { data: items, error: itemsErr } = await supabase
        .from('list_items')
        .select()
        .in('list_kind', ['tbr_top', 'tbr_pool'])
      if (itemsErr) throw itemsErr
      if (!items || items.length === 0) return { top: [], pool: [] }

      const bookIds = items.map((i) => i.book_id)
      const { data: books, error: booksErr } = await supabase
        .from('books')
        .select()
        .in('id', bookIds)
      if (booksErr) throw booksErr

      const bookById = new Map((books ?? []).map((b) => [b.id, b]))
      const enriched: TbrEntry[] = items
        .map((item) => {
          const book = bookById.get(item.book_id)
          return book ? { item, book } : null
        })
        .filter((x): x is TbrEntry => x !== null)

      const top = enriched
        .filter((x) => x.item.list_kind === 'tbr_top')
        .sort(
          (a, b) =>
            (a.item.position ?? Number.MAX_SAFE_INTEGER) -
            (b.item.position ?? Number.MAX_SAFE_INTEGER),
        )

      const pool = enriched
        .filter((x) => x.item.list_kind === 'tbr_pool')
        .sort((a, b) => a.item.created_at.localeCompare(b.item.created_at))

      return { top, pool }
    },
  })
}

/** All list memberships for a single book (TBR + wishlist, when wishlist arrives). */
export function useBookListMembership(bookId: string | undefined) {
  return useQuery({
    queryKey: bookId ? listMembershipKey(bookId) : ['list_items', 'none'],
    enabled: Boolean(bookId),
    queryFn: async (): Promise<ListItemRow[]> => {
      const { data, error } = await supabase
        .from('list_items')
        .select()
        .eq('book_id', bookId!)
      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * Move a book onto a TBR list (top or pool). If the book was already
 * on the other TBR list, that entry is removed first so a book is
 * never on both. Top is capped at 10 — beyond that we throw a friendly
 * error for the UI to surface.
 */
export function useAddToTbr() {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async ({
      bookId,
      kind,
    }: {
      bookId: string
      kind: Extract<ListKind, 'tbr_top' | 'tbr_pool'>
    }) => {
      if (!session) throw new Error('Not signed in')
      const userId = session.user.id

      let position: number | null = null
      if (kind === 'tbr_top') {
        const { data: existing, error } = await supabase
          .from('list_items')
          .select('position')
          .eq('list_kind', 'tbr_top')
          .order('position', { ascending: false })
        if (error) throw error

        // Existing entries we're about to remove (this book being
        // promoted from pool) shouldn't count toward the cap.
        const { data: thisBookTop } = await supabase
          .from('list_items')
          .select('id')
          .eq('book_id', bookId)
          .eq('list_kind', 'tbr_top')
        const alreadyOnTop = (thisBookTop?.length ?? 0) > 0
        const effectiveCount = (existing?.length ?? 0) - (alreadyOnTop ? 1 : 0)

        if (effectiveCount >= TBR_MAX_TOP) {
          throw new Error(
            `Your TBR top is full (${TBR_MAX_TOP} books). Demote or remove one first.`,
          )
        }
        position = (existing?.[0]?.position ?? 0) + 1
      }

      // Wipe any existing TBR membership for this book so we don't
      // collide with the (user_id, book_id, list_kind) UNIQUE.
      const { error: delErr } = await supabase
        .from('list_items')
        .delete()
        .eq('book_id', bookId)
        .in('list_kind', ['tbr_top', 'tbr_pool'])
      if (delErr) throw delErr

      const { error: insErr } = await supabase.from('list_items').insert({
        user_id: userId,
        book_id: bookId,
        list_kind: kind,
        position,
      })
      if (insErr) throw insErr
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: tbrKey })
      qc.invalidateQueries({ queryKey: tbrTopIdsKey })
      qc.invalidateQueries({ queryKey: listMembershipKey(vars.bookId) })
    },
  })
}

export function useRemoveFromTbr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bookId: string) => {
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('book_id', bookId)
        .in('list_kind', ['tbr_top', 'tbr_pool'])
      if (error) throw error
    },
    onSuccess: (_data, bookId) => {
      qc.invalidateQueries({ queryKey: tbrKey })
      qc.invalidateQueries({ queryKey: tbrTopIdsKey })
      qc.invalidateQueries({ queryKey: listMembershipKey(bookId) })
    },
  })
}
