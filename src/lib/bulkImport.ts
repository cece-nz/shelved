import { normalizeIsbn } from './openLibrary.ts'

export type BulkBookRow = {
  lineNumber: number
  isbn: string | null
  title: string
  authors: string[]
}

export type BulkParseResult = {
  rows: BulkBookRow[]
  skipped: { lineNumber: number; reason: string; raw: string }[]
}

/** Split authors on comma, semicolon, or " & ". */
export function parseAuthors(raw: string): string[] {
  return raw
    .split(/\s*[,;]\s*|\s+&\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

function looksLikeIsbnField(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '')
  return /^\d{9}[\dXx]$|^\d{13}$/.test(digits)
}

function rowFromParts(
  parts: string[],
  lineNumber: number,
  order: 'isbn-first' | 'title-first',
): BulkBookRow | null {
  const cleaned = parts
    .map((p) => p.replace(/^"|"$/g, '').trim())
    .filter((p, _i, arr) => (arr.length >= 3 ? true : p !== ''))

  if (cleaned.length < 2) return null

  let isbn: string | null = null
  let title: string
  let authorRaw: string

  if (cleaned.length >= 3) {
    if (order === 'isbn-first' || looksLikeIsbnField(cleaned[0])) {
      isbn = cleaned[0] ? normalizeIsbn(cleaned[0]) : null
      title = cleaned[1]
      authorRaw = cleaned.slice(2).join(', ')
    } else if (looksLikeIsbnField(cleaned[cleaned.length - 1])) {
      title = cleaned[0]
      authorRaw = cleaned.slice(1, -1).join(', ')
      isbn = normalizeIsbn(cleaned[cleaned.length - 1])
    } else {
      title = cleaned[0]
      authorRaw = cleaned.slice(1).join(', ')
    }
  } else {
    if (looksLikeIsbnField(cleaned[0])) {
      isbn = normalizeIsbn(cleaned[0])
      title = cleaned[1]
      authorRaw = ''
    } else {
      title = cleaned[0]
      authorRaw = cleaned[1]
    }
  }

  if (!title) return null
  const authors = parseAuthors(authorRaw)
  if (authors.length === 0 && !authorRaw) {
    // Allow title-only rows; author can be filled later
    return { lineNumber, isbn, title, authors: [] }
  }
  if (authors.length === 0) return null

  return { lineNumber, isbn, title, authors }
}

/**
 * Parse pasted spreadsheet export or plain text.
 *
 * Supported:
 *   - Header row: isbn, title, author(s) (any order)
 *   - Tab- or comma-separated: ISBN, Title, Author
 *   - Two columns: Title, Author (no ISBN on that row)
 *   - Three columns with blank ISBN: ,Title,Author or empty ISBN cell in spreadsheet
 *   - Mix rows in one paste — some with ISBN, some without
 *   - Lines starting with # are ignored
 */
export function parseBulkImportText(text: string): BulkParseResult {
  const lines = text.split(/\r?\n/)
  const rows: BulkBookRow[] = []
  const skipped: BulkParseResult['skipped'] = []

  let columnMap: Record<string, number> | null = null
  let delimiter: ',' | '\t' | null = null

  function splitLine(raw: string): string[] {
    const useTab =
      delimiter === '\t' ||
      (delimiter === null &&
        raw.includes('\t') &&
        (!raw.includes(',') || raw.split('\t').length > raw.split(',').length))
    if (useTab) {
      if (delimiter === null) delimiter = '\t'
      return raw.split('\t').map((p) => p.replace(/^"|"$/g, '').trim())
    }
    if (delimiter === null) delimiter = ','
    return parseCsvLine(raw)
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (!columnMap) {
      const lower = trimmed.toLowerCase()
      if (
        lower.includes('title') &&
        (lower.includes('author') || lower.includes('isbn'))
      ) {
        delimiter = trimmed.includes('\t') ? '\t' : ','
        const headerParts = splitLine(raw)
        columnMap = {}
        headerParts.forEach((h, idx) => {
          const key = h.toLowerCase().replace(/[^a-z]/g, '')
          if (key.includes('isbn')) columnMap!.isbn = idx
          else if (key.includes('title')) columnMap!.title = idx
          else if (key.includes('author')) columnMap!.author = idx
        })
        continue
      }
    }

    const lineNumber = i + 1
    const parts = splitLine(raw)

    let row: BulkBookRow | null = null

    if (columnMap && columnMap.title != null) {
      const title = (parts[columnMap.title] ?? '').replace(/^"|"$/g, '').trim()
      const authorRaw = (
        columnMap.author != null ? parts[columnMap.author] : ''
      )
        .replace(/^"|"$/g, '')
        .trim()
      const isbnRaw =
        columnMap.isbn != null
          ? (parts[columnMap.isbn] ?? '').replace(/^"|"$/g, '').trim()
          : ''
      const isbn = isbnRaw && looksLikeIsbnField(isbnRaw) ? normalizeIsbn(isbnRaw) : null
      const authors = parseAuthors(authorRaw)
      if (title) {
        row = { lineNumber, isbn, title, authors }
      }
    } else {
      row = rowFromParts(parts, lineNumber, 'isbn-first')
    }

    if (row) rows.push(row)
    else skipped.push({ lineNumber, reason: 'Need at least title (and author, or use header row)', raw: trimmed })
  }

  return { rows, skipped }
}
