import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import type { NoteRow } from '../lib/database.types.ts'

export const notesByBookKey = (bookId: string) =>
  ['notes', 'book', bookId] as const

export function useNotes(bookId: string | undefined) {
  return useQuery({
    queryKey: bookId ? notesByBookKey(bookId) : ['notes', 'none'],
    enabled: Boolean(bookId),
    queryFn: async (): Promise<NoteRow[]> => {
      const { data, error } = await supabase
        .from('notes')
        .select()
        .eq('book_id', bookId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddNote(bookId: string) {
  const qc = useQueryClient()
  const { session } = useAuth()

  return useMutation({
    mutationFn: async (body: string): Promise<NoteRow> => {
      if (!session) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: session.user.id,
          book_id: bookId,
          body,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notesByBookKey(bookId) })
    },
  })
}

export function useDeleteNote(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (noteId: string): Promise<void> => {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notesByBookKey(bookId) })
    },
  })
}
