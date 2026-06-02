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

  // 200 doesn't mean we got an image — Amazon listing pages, OL search
  // pages, etc. happily return 200 with HTML. Reject anything that
  // isn't image/* so we don't shove garbage into Storage.
  if (!blob.type.startsWith('image/')) {
    throw new Error(
      `That URL returned ${blob.type || 'unknown content'} — paste a direct image URL (right-click image → "Copy image address").`,
    )
  }

  const path = `${userId}/${bookId}.jpg`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  })
  if (error) throw error

  return path
}

/**
 * Upload a local File (from a `<input type="file">`) as a book cover.
 * Same storage path as URL-fetched covers, so they overwrite each other.
 */
export async function uploadCoverFile(
  file: File,
  userId: string,
  bookId: string,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please pick an image file.')
  }
  const path = `${userId}/${bookId}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  })
  if (error) throw error
  return path
}

/** Same as uploadCoverFile but targets a per-edition path. */
export async function uploadEditionCoverFile(
  file: File,
  userId: string,
  bookId: string,
  editionId: string,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please pick an image file.')
  }
  const path = `${userId}/${bookId}/edition-${editionId}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  })
  if (error) throw error
  return path
}

/**
 * Resolve a stored cover path to a public URL, or null if no path.
 * Optionally appends a `?v=...` cache buster — pass the book's
 * `updated_at` so that re-uploading to the same path immediately shows
 * the new image instead of the browser/CDN serving a stale version.
 */
export function getCoverUrl(
  path: string | null | undefined,
  version?: string | null,
): string | null {
  if (!path) return null
  const base = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  if (!version) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}v=${encodeURIComponent(version)}`
}
