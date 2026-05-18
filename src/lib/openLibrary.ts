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
}

export class IsbnNotFoundError extends Error {
  constructor(isbn: string) {
    super(`No book found for ISBN ${isbn}`)
    this.name = 'IsbnNotFoundError'
  }
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

  return {
    isbn,
    title: book.title ?? 'Untitled',
    authors: (book.authors ?? [])
      .map((a) => a.name)
      .filter((n): n is string => Boolean(n)),
    publisher: book.publishers?.[0]?.name ?? null,
    publishedYear: parseYear(book.publish_date),
    pageCount: book.number_of_pages ?? null,
    description:
      isbnRes.status === 'fulfilled' ? extractDescription(isbnRes.value) : null,
    // Cap categories — OL often returns 30+ subjects, mostly low-value.
    categories: (book.subjects ?? [])
      .map((s) => s.name)
      .filter((n): n is string => Boolean(n))
      .slice(0, 8),
    coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  }
}

/** Strip hyphens and whitespace; uppercase any trailing X check digit. */
export function normalizeIsbn(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
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
