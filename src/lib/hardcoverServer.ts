// Server-side Hardcover lookup, shared by the Netlify function (production)
// and the Vite dev middleware (local) so both behave identically.
//
// The token is passed in by the caller — this module never reads it from a
// VITE_ var and is never imported by client code, so the token stays off the
// browser. Returns a small normalised shape; any problem returns
// { match: false, ... } so the app quietly falls back to Open Library.

const ENDPOINT = 'https://api.hardcover.app/v1/graphql'

// Core query: edition format + series. Proven to work; kept stable.
const MAIN_QUERY = `
  query LookupByIsbn($isbn: String!) {
    editions(
      where: { _or: [{ isbn_13: { _eq: $isbn } }, { isbn_10: { _eq: $isbn } }] }
      limit: 1
    ) {
      edition_format
      pages
      book {
        book_series(limit: 5) {
          featured
          position
          series { name }
        }
      }
    }
  }
`

// Separate tags query — runs in parallel, failure silently returns [].
// cached_tags is a JSONB object keyed by category ("Genre", "Mood", "Tag", etc.)
// where each value is an array of { tag, count, ... } sorted by count desc.
const TAGS_QUERY = `
  query BookTagsByIsbn($isbn: String!) {
    editions(
      where: { _or: [{ isbn_13: { _eq: $isbn } }, { isbn_10: { _eq: $isbn } }] }
      limit: 1
    ) {
      book {
        cached_tags
      }
    }
  }
`

export type HardcoverResult = {
  match: boolean
  editionFormat?: string | null
  pages?: number | null
  seriesName?: string | null
  seriesIndex?: number | null
  genres?: string[]
  moods?: string[]
  error?: string
}

type BookSeries = {
  featured?: boolean
  position?: number | null
  series?: { name?: string | null } | null
}

type CachedTagEntry = {
  tag: string
  count: number
}

// cached_tags shape: { Genre: CachedTagEntry[], Mood: CachedTagEntry[], ... }
function extractTagNames(
  raw: unknown,
  category: string,
  limit = 5,
): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const entries = (raw as Record<string, CachedTagEntry[]>)[category]
  if (!Array.isArray(entries)) return []
  return entries
    .slice(0, limit)
    .map((e) => e.tag)
    .filter((t): t is string => typeof t === 'string')
}

async function gql(
  query: string,
  variables: Record<string, string>,
  token: string,
): Promise<unknown> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`hardcover_${res.status}`)
  return res.json()
}

export async function hardcoverLookup(
  rawIsbn: string | null | undefined,
  token: string | undefined,
): Promise<HardcoverResult> {
  if (!token) return { match: false, error: 'not_configured' }
  const isbn = rawIsbn?.replace(/[\s-]/g, '')
  if (!isbn) return { match: false, error: 'missing_isbn' }

  try {
    // Run both queries in parallel; tags failure is non-fatal.
    const [mainResult, tagsResult] = await Promise.allSettled([
      gql(MAIN_QUERY, { isbn }, token),
      gql(TAGS_QUERY, { isbn }, token),
    ])

    if (mainResult.status === 'rejected') {
      return { match: false, error: String(mainResult.reason) }
    }

    const mainJson = mainResult.value as Record<string, unknown>
    const editions = (mainJson?.data as Record<string, unknown>)?.editions as unknown[] | undefined
    const edition = editions?.[0] as Record<string, unknown> | undefined
    if (!edition) return { match: false }

    const list: BookSeries[] = (edition.book as Record<string, unknown>)?.book_series as BookSeries[] ?? []
    const bs = list.find((s) => s.featured) ?? list[0]

    let genres: string[] = []
    let moods: string[] = []
    if (tagsResult.status === 'fulfilled') {
      try {
        const tj = tagsResult.value as Record<string, unknown>
        const te = ((tj?.data as Record<string, unknown>)?.editions as unknown[])?.[0] as Record<string, unknown> | undefined
        const raw = (te?.book as Record<string, unknown>)?.cached_tags
        genres = extractTagNames(raw, 'Genre')
        moods = extractTagNames(raw, 'Mood')
      } catch {
        // silently ignore
      }
    }

    return {
      match: true,
      editionFormat: edition.edition_format as string | null ?? null,
      pages: edition.pages as number | null ?? null,
      seriesName: bs?.series?.name ?? null,
      seriesIndex: bs?.position ?? null,
      genres,
      moods,
    }
  } catch (err) {
    return {
      match: false,
      error: err instanceof Error ? err.message : 'fetch_failed',
    }
  }
}
