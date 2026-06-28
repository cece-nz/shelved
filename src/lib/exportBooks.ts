import { supabase } from './supabase.ts'
import { rowsToCsv, downloadCsv } from './csv.ts'
import type { BookRow, EditionRow, ReadingStatus } from './database.types.ts'

const READING_STATUS_LABEL: Record<ReadingStatus, string> = {
  want_to_read: 'Want to read',
  reading: 'In progress',
  read: 'Read',
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Fetch the whole library and download as CSV — one row per edition.
 * Columns line up with bulk import (isbn, title, author) plus metadata.
 * Returns the number of rows exported.
 */
export async function exportBooksToCsv(): Promise<number> {
  const [booksRes, editionsRes, storesRes] = await Promise.all([
    supabase.from('books').select().order('title', { ascending: true }),
    supabase.from('editions').select().order('created_at', { ascending: true }),
    supabase.from('stores').select(),
  ])
  if (booksRes.error) throw booksRes.error
  if (editionsRes.error) throw editionsRes.error
  if (storesRes.error) throw storesRes.error

  const books = booksRes.data ?? []
  const bookById = new Map(books.map((b) => [b.id, b]))
  const storeName = new Map((storesRes.data ?? []).map((s) => [s.id, s.name]))

  const columns = [
    'isbn',
    'title',
    'author',
    'format',
    'edition_name',
    'series',
    'series_number',
    'reading_status',
    'rating',
    'reading_age',
    'genre',
    'sub_genre',
    'mood',
    'publisher',
    'published_year',
    'pages',
    'purchase_date',
    'purchase_price',
    'currency',
    'store',
    'condition',
    'acquired',
    'pre_order',
    'date_added',
    'description',
  ]

  const editions = (editionsRes.data ?? []) as EditionRow[]
  const rows: (string | number)[][] = []

  for (const e of editions) {
    const b = bookById.get(e.book_id)
    if (!b) continue
    rows.push(editionToRow(e, b, storeName))
  }

  // Books with no editions still appear as a single row (title/author only).
  const booksWithEdition = new Set(editions.map((e) => e.book_id))
  for (const b of books) {
    if (booksWithEdition.has(b.id)) continue
    rows.push(bookOnlyRow(b))
  }

  rows.sort((a, b) => {
    const t = String(a[1]).localeCompare(String(b[1]))
    return t !== 0 ? t : String(a[0]).localeCompare(String(b[0]))
  })

  const today = new Date().toISOString().slice(0, 10)
  downloadCsv(`shelved-library-${today}.csv`, rowsToCsv(columns, rows))
  return rows.length
}

function editionToRow(
  e: EditionRow,
  b: BookRow,
  storeName: Map<string, string>,
): (string | number)[] {
  return [
    e.isbn ?? '',
    b.title,
    b.authors.join('; '),
    e.format,
    e.display_name ?? '',
    b.series_name ?? '',
    b.series_index ?? '',
    b.reading_status ? READING_STATUS_LABEL[b.reading_status] : '',
    b.rating ?? '',
    b.reading_age ?? '',
    b.genre ?? '',
    b.sub_genre ?? '',
    b.mood ?? '',
    e.publisher ?? b.publisher ?? '',
    b.published_year ?? '',
    e.page_count ?? '',
    e.purchase_date ?? '',
    e.purchase_price ?? '',
    e.currency ?? 'NZD',
    e.store_id ? (storeName.get(e.store_id) ?? '') : '',
    e.condition ?? '',
    e.acquired === 'unknown' ? '' : cap(e.acquired),
    e.is_preorder ? 'yes' : '',
    b.created_at ? b.created_at.slice(0, 10) : '',
    b.description ?? '',
  ]
}

function bookOnlyRow(b: BookRow): (string | number)[] {
  return [
    '',
    b.title,
    b.authors.join('; '),
    '',
    '',
    b.series_name ?? '',
    b.series_index ?? '',
    b.reading_status ? READING_STATUS_LABEL[b.reading_status] : '',
    b.rating ?? '',
    b.reading_age ?? '',
    b.genre ?? '',
    b.sub_genre ?? '',
    b.mood ?? '',
    b.publisher ?? '',
    b.published_year ?? '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    b.created_at ? b.created_at.slice(0, 10) : '',
    b.description ?? '',
  ]
}
