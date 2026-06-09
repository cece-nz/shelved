import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Upload, AlertTriangle } from 'lucide-react'
import { parseBulkImportText, type BulkBookRow } from '../lib/bulkImport.ts'
import { useBulkAddBooks } from '../queries/books.ts'
import { LoadingButton } from '../components/LoadingButton.tsx'

const EXAMPLE = `isbn,title,author
9780141439518,Pride and Prejudice,Jane Austen
,The Hobbit,J.R.R. Tolkien
Dune,Frank Herbert`

export function BulkAdd() {
  const [text, setText] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const bulkAdd = useBulkAddBooks()

  const parsed = useMemo(() => parseBulkImportText(text), [text])
  const previewRows = parsed.rows

  const onImport = async () => {
    if (previewRows.length === 0) return
    setConfirmed(true)
    await bulkAdd.mutateAsync(previewRows)
  }

  const results = bulkAdd.data
  const successCount = results?.filter((r) => r.ok).length ?? 0
  const failCount = results?.filter((r) => !r.ok).length ?? 0

  return (
    <>
      <title>Bulk add · Shelved</title>

      <header className="mb-4 min-w-0">
        <Link
          to="/add"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to add book
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Bulk add books
        </h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Temporary import tool — ISBN, title, and author only. Each row becomes a
            paperback edition; add covers and purchase details on the book page later.
          </span>
        </p>
      </header>

      <section className="space-y-3 mb-4">
        <label htmlFor="bulk-paste" className="block text-sm font-medium text-slate-700">
          Paste from spreadsheet or type rows
        </label>
        <textarea
          id="bulk-paste"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setConfirmed(false)
            bulkAdd.reset()
          }}
          rows={12}
          placeholder={EXAMPLE}
          className="w-full min-w-0 font-mono text-xs sm:text-sm rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
          spellCheck={false}
        />
        <details className="text-xs text-slate-600" open>
          <summary className="cursor-pointer hover:text-slate-800">Format help (ISBN optional per row)</summary>
          <ul className="mt-2 space-y-1.5 list-disc pl-4">
            <li>
              <strong>Best for a mix:</strong> use a header row and three columns — leave the ISBN
              cell empty when you don&apos;t have one:
              <pre className="mt-1 p-2 bg-slate-100 rounded text-[11px] overflow-x-auto">{`isbn,title,author
9780141439518,Pride and Prejudice,Jane Austen
,The Hobbit,J.R.R. Tolkien`}</pre>
            </li>
            <li>
              <strong>No ISBN at all:</strong> two columns only — <code>title, author</code>
            </li>
            <li>
              <strong>ISBN only on some rows:</strong> three columns; start the line with a comma
              or leave the first cell blank: <code>,Title,Author</code>
            </li>
            <li>Comma or tab separated (paste from Excel/Sheets works)</li>
            <li>Lines starting with <code>#</code> are ignored</li>
          </ul>
        </details>
      </section>

      {parsed.skipped.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50/80 p-3">
          <p className="text-xs font-medium text-amber-900 mb-1">
            {parsed.skipped.length} line{parsed.skipped.length === 1 ? '' : 's'} skipped
          </p>
          <ul className="text-xs text-amber-800 space-y-0.5 max-h-24 overflow-y-auto">
            {parsed.skipped.slice(0, 8).map((s) => (
              <li key={s.lineNumber}>
                Line {s.lineNumber}: {s.reason}
              </li>
            ))}
            {parsed.skipped.length > 8 && (
              <li>…and {parsed.skipped.length -  8} more</li>
            )}
          </ul>
        </div>
      )}

      {previewRows.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-slate-700 mb-2">
            Preview ({previewRows.length} book{previewRows.length === 1 ? '' : 's'})
          </h2>
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white mb-4 max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium text-slate-600">ISBN</th>
                  <th className="text-left px-2 py-1.5 font-medium text-slate-600">Title</th>
                  <th className="text-left px-2 py-1.5 font-medium text-slate-600">Author(s)</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <PreviewRow key={row.lineNumber} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {!confirmed && (
            <LoadingButton
              type="button"
              onClick={onImport}
              pending={bulkAdd.isPending}
              pendingLabel={`Adding…`}
              icon={Upload}
              disabled={previewRows.length === 0}
              className="w-full rounded-md bg-teal-500 hover:bg-teal-600 px-4 py-2.5 text-sm text-white font-medium"
            >
              Add {previewRows.length} book{previewRows.length === 1 ? '' : 's'}
            </LoadingButton>
          )}
        </>
      )}

      {text.trim() && previewRows.length === 0 && parsed.skipped.length === 0 && (
        <p className="text-sm text-slate-500">No valid rows yet — check the format above.</p>
      )}

      {bulkAdd.isPending && (
        <p className="text-sm text-slate-600 mt-3" role="status">
          Importing… this may take a moment for large lists.
        </p>
      )}

      {results && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-slate-800">
            Done: {successCount} added
            {failCount > 0 && `, ${failCount} failed`}
          </p>
          {failCount > 0 && (
            <ul className="text-xs text-rose-700 space-y-1 max-h-40 overflow-y-auto rounded-md border border-rose-200 bg-rose-50 p-2">
              {results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.row.lineNumber}>
                    Line {r.row.lineNumber} ({r.row.title}): {r.error}
                  </li>
                ))}
            </ul>
          )}
          {successCount > 0 && (
            <Link
              to="/"
              className="inline-block text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              View your bookcase →
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setText('')
              setConfirmed(false)
              bulkAdd.reset()
            }}
            className="block text-xs text-slate-500 hover:text-slate-700"
          >
            Import another batch
          </button>
        </div>
      )}

      {bulkAdd.error && (
        <p className="text-sm text-rose-600 mt-2">{bulkAdd.error.message}</p>
      )}
    </>
  )
}

function PreviewRow({ row }: { row: BulkBookRow }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-1.5 font-mono text-slate-500 whitespace-nowrap">
        {row.isbn ?? '—'}
      </td>
      <td className="px-2 py-1.5 text-slate-900 max-w-[140px] truncate">{row.title}</td>
      <td className="px-2 py-1.5 text-slate-600 max-w-[120px] truncate">
        {row.authors.length > 0 ? row.authors.join(', ') : '—'}
      </td>
    </tr>
  )
}
