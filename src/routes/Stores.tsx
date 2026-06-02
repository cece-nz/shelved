import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Store as StoreIcon } from 'lucide-react'
import { useStores, useAddStore } from '../queries/stores.ts'

export function Stores() {
  const { data: stores = [], isPending, error } = useStores()
  const add = useAddStore()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [adding, setAdding] = useState(false)

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    await add.mutateAsync({ name: n, location: location.trim() || null })
    setName('')
    setLocation('')
    setAdding(false)
  }

  return (
    <>
      <title>Stores · Shelved</title>
      <header className="mb-5 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Stores
        </h1>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium px-3 py-1.5"
          >
            <Plus className="h-4 w-4" /> New store
          </button>
        )}
      </header>

      {adding && (
        <form
          onSubmit={onAdd}
          className="mb-5 rounded-xl border border-slate-200 bg-white p-3 space-y-2"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Store name"
            autoFocus
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={add.isPending || !name.trim()}
              className="rounded-full bg-teal-500 hover:bg-teal-600 text-white text-sm px-4 py-1.5 disabled:opacity-60"
            >
              {add.isPending ? 'Saving…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setName('')
                setLocation('')
              }}
              className="rounded-full border border-slate-300 text-slate-700 text-sm px-4 py-1.5 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          {add.error && (
            <p className="text-xs text-rose-600">{add.error.message}</p>
          )}
        </form>
      )}

      {isPending && <p className="text-sm text-slate-500">Loading…</p>}
      {error && (
        <p className="text-sm text-rose-600">Failed to load: {error.message}</p>
      )}

      {stores.length === 0 && !isPending && !adding && (
        <p className="text-sm text-slate-500">
          No stores yet. Add one to start tracking purchases.
        </p>
      )}

      {stores.length > 0 && (
        <ul className="space-y-2">
          {stores.map((s) => (
            <li key={s.id}>
              <Link
                to={`/stores/${s.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-teal-300 hover:shadow-sm transition"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700 shrink-0">
                  <StoreIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {s.name}
                  </p>
                  {s.location && (
                    <p className="text-xs text-slate-500 truncate">
                      {s.location}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
