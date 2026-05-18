import { supabase } from './supabase.ts'

const BUCKET = 'covers'

/**
 * Download a cover image from an external URL and upload it to the
 * `covers` Storage bucket. Returns the storage path, suitable for
 * persisting in books.cover_path.
 *
 * Path convention: `<user_id>/<book_id>.jpg`. The user_id prefix
 * keeps each account's covers in their own folder; the book_id
 * filename means re-uploading replaces the old cover atomically.
 */
export async function downloadAndStoreCover(
  sourceUrl: string,
  userId: string,
  bookId: string,
): Promise<string> {
  const res = await fetch(sourceUrl)
  if (!res.ok) {
    throw new Error(`Cover fetch failed: ${res.status} ${res.statusText}`)
  }

  const blob = await res.blob()
  const path = `${userId}/${bookId}.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  })
  if (error) throw error

  return path
}

/** Resolve a stored cover path to a public URL, or null if no path. */
export function getCoverUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
