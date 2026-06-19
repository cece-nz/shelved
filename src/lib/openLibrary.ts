// Thin wrapper around the Open Library API (free, no key, no quota).
//
// We use two endpoints in parallel for each ISBN lookup:
//   - /api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data
//       → clean aggregated metadata (title, authors, publishers, subjects)
//   - /isbn/<isbn>.json
//       → richer per-edition data including the description
// Covers come from a separate stable URL pattern:
//   https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg?default=false
// (the `default=false` query makes it 404 if no cover exists, which the
// <img> tag's onError can pick up to show a placeholder.)

import type { Format } from './database.types.ts'

export type IsbnLookupResult = {
  isbn: string
  title: string
  authors: string[]
  publisher: string | null
  publishedYear: number | null
  description: string | null
  categories: string[]
  pageCount: number | null
  coverUrl: string | null
  /** Edition binding mapped to our format enum — null if OL didn't say. */
  format: Format | null
  /** Series, when OL's edition record carries it (often it doesn't). */
  seriesName: string | null
  seriesIndex: number | null
  /**
   * Open Library "Work" identifier (e.g. "OL66554W"). Stable across
   * editions: paperback + hardcover + audiobook of the same novel
   * share it. Null when OL has the ISBN but no associated work — rare.
   */
  workId: string | null
}

export class IsbnNotFoundError extends Error {
  constructor(isbn: string) {
    super(`No book found for ISBN ${isbn}`)
    this.name = 'IsbnNotFoundError'
  }
}

export type TitleSearchResult = {
  /** Open Library work key, e.g. "OL12345W". */
  workKey: string
  title: string
  authors: string[]
  firstPublishYear: number | null
  coverUrl: string | null
  /** Up to a few ISBNs to feed into the existing ISBN lookup pipeline. */
  isbns: string[]
}

type SearchDoc = {
  key?: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  isbn?: string[]
}

/**
 * Search Open Library by title. Returns up to `limit` matches that
 * have at least one ISBN (so the existing ISBN-lookup pipeline can
 * pick up cover, description, work-id, and dedup work).
 */
export async function searchByTitle(
  query: string,
  limit = 10,
): Promise<TitleSearchResult[]> {
  const url =
    `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}` +
    `&fields=key,title,author_name,first_publish_year,cover_i,isbn&limit=${limit}`
  const res = await fetchWithRetry(url)
  if (!res.ok) throw new Error(`Search failed: ${res.status} ${res.statusText}`)
  const data = (await res.json()) as { docs?: SearchDoc[] }

  return (data.docs ?? [])
    .map((doc): TitleSearchResult => {
      const isbns = (doc.isbn ?? [])
        .map((i) => i.replace(/[\s-]/g, '').toUpperCase())
        .filter((i) => /^(\d{13}|\d{9}[\dX])$/.test(i))
      return {
        workKey: doc.key?.replace(/^\/works\//, '') ?? '',
        title: doc.title ?? 'Untitled',
        authors: doc.author_name ?? [],
        firstPublishYear: doc.first_publish_year ?? null,
        coverUrl: doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : null,
        // Prefer ISBN-13s when both exist.
        isbns: [...isbns].sort((a, b) => b.length - a.length).slice(0, 5),
      }
    })
    .filter((r) => r.isbns.length > 0)
}

/** Heuristic: numeric-only, 10-17 chars (allowing hyphens/spaces) = ISBN-shaped. */
export function looksLikeIsbn(input: string): boolean {
  const cleaned = input.replace(/[\s-]/g, '')
  if (cleaned.length < 10 || cleaned.length > 17) return false
  return /^[0-9X]+$/i.test(cleaned)
}

type DataEndpointBook = {
  title?: string
  authors?: { name?: string }[]
  publishers?: { name?: string }[]
  publish_date?: string
  number_of_pages?: number
  subjects?: { name?: string }[]
}

type DataEndpointResponse = Record<string, DataEndpointBook>

type IsbnEndpointResponse = {
  description?: string | { value?: string }
  works?: { key?: string }[]
  physical_format?: string
  series?: string[]
  number_of_pages?: number
}

/**
 * Look up a book by ISBN. Throws IsbnNotFoundError if no match,
 * or Error for network/parse failures.
 */
export async function lookupByIsbn(rawIsbn: string): Promise<IsbnLookupResult> {
  const isbn = normalizeIsbn(rawIsbn)
  const key = `ISBN:${isbn}`
  const dataUrl = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(key)}&format=json&jscmd=data`
  const isbnUrl = `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`

  const [dataRes, isbnRes] = await Promise.allSettled([
    fetchJson<DataEndpointResponse>(dataUrl),
    fetchJson<IsbnEndpointResponse>(isbnUrl),
  ])

  const book =
    dataRes.status === 'fulfilled' ? dataRes.value[key] : undefined

  if (!book) throw new IsbnNotFoundError(isbn)

  const edition = isbnRes.status === 'fulfilled' ? isbnRes.value : null
  const series = parseSeries(edition?.series)

  return {
    isbn,
    title: book.title ?? 'Untitled',
    authors: (book.authors ?? [])
      .map((a) => a.name)
      .filter((n): n is string => Boolean(n)),
    publisher: book.publishers?.[0]?.name ?? null,
    publishedYear: parseYear(book.publish_date),
    pageCount: book.number_of_pages ?? edition?.number_of_pages ?? null,
    description: edition ? extractDescription(edition) : null,
    workId: edition ? extractWorkId(edition) : null,
    // Cap categories — OL often returns 30+ subjects, mostly low-value.
    categories: (book.subjects ?? [])
      .map((s) => s.name)
      .filter((n): n is string => Boolean(n))
      .slice(0, 8),
    coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
    format: mapPhysicalFormat(edition?.physical_format),
    seriesName: series?.name ?? null,
    seriesIndex: series?.index ?? null,
  }
}

/** Map a free-text binding string (OL physical_format / Hardcover edition_format) to our enum. */
export function mapPhysicalFormat(raw: string | undefined): Format | null {
  if (!raw) return null
  const s = raw.toLowerCase()
  if (/audio|\bcd\b|cassette|mp3|spoken/.test(s)) return 'audiobook'
  if (/kindle|e-?book|electronic|epub|digital/.test(s)) return 'ebook'
  if (/hardcover|hardback|library binding|board book/.test(s)) return 'hardcover'
  if (/paperback|softcover|mass market|trade paper|pocket/.test(s))
    return 'paperback'
  if (/special|deluxe|collector|box ?set|slipcase/.test(s))
    return 'special_edition'
  return null
}

/** Parse OL's series strings (e.g. "The Empyrean #1") into name + number. */
function parseSeries(
  series: string[] | undefined,
): { name: string; index: number | null } | null {
  const raw = series?.[0]?.trim()
  if (!raw) return null
  const clean = (s: string) => s.replace(/[\s#(),;:.\-]+$/, '').trim()
  const m = raw.match(/^(.*?)[\s,(]*#?\s*(\d+(?:\.\d+)?)\s*\)?\s*$/)
  if (m && clean(m[1])) {
    return { name: clean(m[1]), index: Number(m[2]) }
  }
  const name = clean(raw)
  return name ? { name, index: null } : null
}

/** Strip hyphens and whitespace; uppercase any trailing X check digit. */
export function normalizeIsbn(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Open Library's endpoints intermittently 500, and their error responses
 * lack CORS headers — so in the browser a 500 surfaces as a thrown
 * "Failed to fetch" rather than a 500 response. Retry a couple of times
 * with a short backoff to ride out those transient blips.
 */
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status >= 500 && attempt < retries) {
        await delay(400 * (attempt + 1))
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      if (attempt >= retries) throw lastErr
      await delay(400 * (attempt + 1))
    }
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url)
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function parseYear(date: string | undefined): number | null {
  if (!date) return null
  const m = date.match(/(\d{4})/)
  return m ? Number(m[1]) : null
}

function extractDescription(payload: IsbnEndpointResponse): string | null {
  const d = payload.description
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && typeof d.value === 'string') return d.value
  return null
}

function extractWorkId(payload: IsbnEndpointResponse): string | null {
  const key = payload.works?.[0]?.key
  if (!key) return null
  const match = key.match(/^\/works\/(OL[A-Z0-9]+W)$/)
  return match ? match[1] : null
}
