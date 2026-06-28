// Client side of the Hardcover enrichment. Calls our Netlify function
// (which holds the API token server-side) and maps the result. Everything
// here is best-effort: any failure returns null so Open Library still works.

import type { Format } from './database.types.ts'
import { mapPhysicalFormat } from './openLibrary.ts'

export type HardcoverEnrichment = {
  format: Format | null
  seriesName: string | null
  seriesIndex: number | null
  pages: number | null
  genreSuggestions: string[]
  moodSuggestions: string[]
}

export async function lookupHardcover(
  isbn: string,
): Promise<HardcoverEnrichment | null> {
  try {
    const res = await fetch(
      `/.netlify/functions/hardcover?isbn=${encodeURIComponent(isbn)}`,
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.match) return null
    return {
      format: mapPhysicalFormat(data.editionFormat ?? undefined),
      seriesName: data.seriesName ?? null,
      seriesIndex:
        data.seriesIndex != null && Number.isFinite(Number(data.seriesIndex))
          ? Number(data.seriesIndex)
          : null,
      pages: data.pages ?? null,
      genreSuggestions: Array.isArray(data.genres) ? data.genres : [],
      moodSuggestions: Array.isArray(data.moods) ? data.moods : [],
    }
  } catch {
    return null
  }
}
