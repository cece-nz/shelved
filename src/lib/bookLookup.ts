import { lookupByIsbn, type IsbnLookupResult } from './openLibrary.ts'
import { lookupHardcover } from './hardcover.ts'

/**
 * Look up a book by ISBN: Open Library for the core metadata (it gives us
 * the work-id used for dedup, plus cover/description), enriched with
 * Hardcover's more reliable edition format + series when available.
 *
 * Throws IsbnNotFoundError when Open Library has no match (same as before).
 * Hardcover is best-effort — if it's not configured or errors, you just
 * get the Open Library result unchanged.
 */
export async function lookupBook(isbn: string): Promise<IsbnLookupResult> {
  const base = await lookupByIsbn(isbn)
  const hc = await lookupHardcover(base.isbn)
  if (!hc) return base
  return {
    ...base,
    format: hc.format ?? base.format,
    seriesName: hc.seriesName ?? base.seriesName,
    seriesIndex: hc.seriesIndex ?? base.seriesIndex,
    pageCount: base.pageCount ?? hc.pages ?? null,
    genreSuggestions: hc.genreSuggestions,
    moodSuggestions: hc.moodSuggestions,
  }
}
