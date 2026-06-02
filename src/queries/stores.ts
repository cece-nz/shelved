import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import type { EditionRow, StoreRow } from '../lib/database.types.ts'

export const storesKey = ['stores'] as const
export const storeKey = (id: string) => ['stores', id] as const
export const storeEditionsKey = (id: string) =>
  ['stores', id, 'editions'] as const

export function useStores() {
  return useQuery({
    queryKey: storesKey,
    queryFn: async (): Promise<StoreRow[]> => {
      const { data, error } = await supabase
        .from('stores')
        .select()
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useStore(id: string | undefined) {
  return useQuery({
    queryKey: id ? storeKey(id) : ['stores', 'none'],
    enabled: Boolean(id),
    queryFn: async (): Promise<StoreRow> => {
      const { data, error } = await supabase
        .from('stores')
        .select()
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })
}

/** Editions bought at a specific store, with their parent book metadata. */
export type StoreEdition = EditionRow & {
  book: { id: string; title: string; authors: string[]; cover_path: string | null }
}

export function useStoreEditions(storeId: string | undefined) {
  return useQuery({
    queryKey: storeId ? storeEditionsKey(storeId) : ['stores', 'none'],
    enabled: Boolean(storeId),
    queryFn: async (): Promise<StoreEdition[]> => {
      const { data: editions, error } = await supabase
        .from('editions')
        .select()
        .eq('store_id', storeId!)
        .order('purchase_date', { ascending: false, nullsFirst: false })
      if (error) throw error
      if (!editions || editions.length === 0) return []
      const bookIds = [...new Set(editions.map((e) => e.book_id))]
      const { data: books, error: booksErr } = await supabase
        .from('books')
        .select('id, title, authors, cover_path')
        .in('id', bookIds)
      if (booksErr) throw booksErr
      const byId = new Map((books ?? []).map((b) => [b.id, b]))
      return editions
        .map((e) => {
          const b = byId.get(e.book_id)
          return b ? { ...e, book: b } : null
        })
        .filter((x): x is StoreEdition => x !== null)
    },
  })
}

export function useAddStore() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (input: {
      name: string
      location?: string | null
      notes?: string | null
    }): Promise<StoreRow> => {
      if (!session) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('stores')
        .insert({
          user_id: session.user.id,
          name: input.name.trim(),
          location: input.location?.trim() || null,
          notes: input.notes?.trim() || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storesKey })
    },
  })
}

export function useUpdateStore(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Pick<StoreRow, 'name' | 'location' | 'notes'>>) => {
      const { error } = await supabase.from('stores').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storesKey })
      qc.invalidateQueries({ queryKey: storeKey(id) })
    },
  })
}

export function useDeleteStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // editions.store_id has ON DELETE SET NULL, so editions stay.
      const { error } = await supabase.from('stores').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storesKey })
    },
  })
}
