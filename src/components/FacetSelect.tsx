import { useState } from 'react'
import { Plus } from 'lucide-react'

/**
 * A single-select picker for a managed vocabulary (genre, mood, etc.):
 * a dropdown of existing values plus a "New" button to add one inline —
 * so you only type when introducing a brand-new option.
 *
 * Controlled via value / onChange (works with plain useState and with
 * react-hook-form watch + setValue).
 */
export function FacetSelect({
  value,
  onChange,
  options,
  placeholder = 'Not set',
  disabled = false,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  // Keep the current value selectable even if it's not in the option list yet.
  const opts = value && !options.includes(value) ? [value, ...options] : options

  const save = () => {
    const v = draft.trim()
    setAdding(false)
    setDraft('')
    if (v) onChange(v)
  }

  if (adding) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            } else if (e.key === 'Escape') {
              setAdding(false)
              setDraft('')
            }
          }}
          autoFocus
          placeholder="New value"
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-teal-300"
        />
        <button
          type="button"
          onClick={save}
          disabled={!draft.trim()}
          className="shrink-0 rounded-full bg-teal-500 hover:bg-teal-600 text-white text-xs px-2.5 py-1.5 disabled:opacity-60"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false)
            setDraft('')
          }}
          className="shrink-0 text-xs text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm disabled:opacity-50 focus:outline-none focus:border-teal-300"
      >
        <option value="">{placeholder}</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          setDraft('')
          setAdding(true)
        }}
        disabled={disabled}
        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Plus className="h-3 w-3" /> New
      </button>
    </div>
  )
}
