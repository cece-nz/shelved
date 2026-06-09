import { supabase } from './supabase.ts'
import { rowsToCsv, downloadCsv } from './csv.ts'
import type { EditionRow, ReadingStatus } from './database.types.ts'

const READING_STATUS_LABEL: Record<ReadingStatus, string> = {
  want_to_read: 'Want to read',
  reading: 'In progress',
  read: 'Read',
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const uniq = (xs: (string | null | undefined)[]) =>
  [...new Set(xs.filter((x): x is string => Boolean(x)))]

/**
 * Fetch the whole library and download it as a CSV — one row per book,
 * with each book's editions summarised into columns. Returns the number
 * of books exported.
 */
export async function exportBooksToCsv(): Promise<number> {
  const [booksRes, editionsRes, storesRes] = await Promise.all([
    supabase.from('books').select().order('title', { ascending: true }),
    supabase.from('editions').select(),
    supabase.from('stores').select(),
  ])
  if (booksRes.error) throw booksRes.error
  if (editionsRes.error) throw editionsRes.error
  if (storesRes.error) throw storesRes.error

  const books = booksRes.data ?? []
  const storeName = new Map((storesRes.data ?? []).map((s) => [s.id, s.name]))

  const edsByBook = new Map<string, EditionRow[]>()
  for (const e of editionsRes.data ?? []) {
    const arr = edsByBook.get(e.book_id)
    if (arr) arr.push(e)
    else edsByBook.set(e.book_id, [e])
  }

  const columns = [
    'Title',
    'Authors',
    'Series',
    'Series #',
    'Reading age',
    'Genre',
    'Sub genre',
    'Mood',
    'Rating',
    'Reading status',
    'Published year',
    'Publisher',
    'Editions',
    'Formats',
    'ISBNs',
    'Acquired',
    'Stores',
    'Total paid (NZD)',
    'Date added',
    'Description',
  ]

  const rows = books.map((b) => {
    const eds = edsByBook.get(b.id) ?? []
    const totalPaid = eds.reduce((sum, e) => sum + (e.purchase_price ?? 0), 0)
    return [
      b.title,
      b.authors.join('; '),
      b.series_name ?? '',
      b.series_index ?? '',
      b.reading_age ?? '',
      b.genre ?? '',
      b.sub_genre ?? '',
      b.mood ?? '',
      b.rating ?? '',
      b.reading_status ? READING_STATUS_LABEL[b.reading_status] : '',
      b.published_year ?? '',
      b.publisher ?? '',
      eds.length,
      uniq(eds.map((e) => e.format)).join('; '),
      uniq(eds.map((e) => e.isbn)).join('; '),
      uniq(eds.map((e) => (e.acquired === 'unknown' ? null : cap(e.acquired)))).join('; '),
      uniq(eds.map((e) => (e.store_id ? storeName.get(e.store_id) : null))).join('; '),
      totalPaid > 0 ? totalPaid.toFixed(2) : '',
      b.created_at ? b.created_at.slice(0, 10) : '',
      b.description ?? '',
    ]
  })

  const today = new Date().toISOString().slice(0, 10)
  downloadCsv(`shelved-books-${today}.csv`, rowsToCsv(columns, rows))
  return rows.length
}
