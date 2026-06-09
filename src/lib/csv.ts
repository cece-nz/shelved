/** Minimal RFC 4180 CSV helpers. */

type Cell = string | number | null | undefined

function csvCell(value: Cell): string {
  if (value == null) return ''
  const s = String(value)
  // Quote if the value contains a comma, quote, or newline.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function rowsToCsv(columns: string[], rows: Cell[][]): string {
  const lines = [columns, ...rows].map((row) => row.map(csvCell).join(','))
  return lines.join('\r\n')
}

/** Build a CSV blob and trigger a browser download. */
export function downloadCsv(filename: string, csv: string): void {
  // Prepend a BOM (﻿) so Excel opens UTF-8 correctly.
  const blob = new Blob(['﻿', csv], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
