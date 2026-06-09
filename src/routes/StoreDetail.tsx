import { Link, useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Trash2 } from 'lucide-react'
import {
  useStore,
  useStoreEditions,
  useDeleteStore,
} from '../queries/stores.ts'
import { Cover } from '../components/Cover.tsx'
import { FormatBadge } from '../components/FormatBadge.tsx'
import { formatDate } from '../lib/dates.ts'

export function StoreDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: store, isPending, error } = useStore(id)
  const { data: editions = [] } = useStoreEditions(id)
  const del = useDeleteStore()

  const total = editions.reduce(
    (sum, e) => sum + (e.purchase_price ?? 0),
    0,
  )

  const onDelete = async () => {
    if (!id) return
    if (
      !window.confirm(
        `Delete "${store?.name}"? Editions stay in your library but lose this store link.`,
      )
    )
      return
    await del.mutateAsync(id)
    navigate('/stores')
  }

  return (
    <>
      <title>{store ? `${store.name} · Shelved` : 'Store · Shelved'}</title>
      <header className="mb-4">
        <Link
          to="/stores"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      {isPending && <p className="text-sm text-slate-500">Loading…</p>}
      {error && (
        <p className="text-sm text-rose-600">Failed to load: {error.message}</p>
      )}

      {store && (
        <>
          <div className="mb-4">
            <h1 className="font-serif text-3xl font-semibold text-slate-900">
              {store.name}
            </h1>
            {store.location && (
              <p className="text-sm text-slate-600 mt-0.5">{store.location}</p>
            )}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Books bought</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">
                {editions.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Total spent</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">
                NZD {total.toFixed(2)}
              </p>
            </div>
          </div>

          {editions.length === 0 ? (
            <p className="text-sm text-slate-500">
              No editions bought here yet. When you add an edition, set the
              store and it'll show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {editions.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/book/${e.book.id}`}
                    className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-teal-300 hover:shadow-sm transition"
                  >
                    <Cover
                      path={e.book.cover_path}
                      title={e.book.title}
                      authors={e.book.authors}
                      className="w-12 h-16 rounded-md shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {e.book.title}
                      </p>
                      <p className="text-xs text-slate-600 truncate">
                        {e.book.authors.join(', ') || 'Unknown author'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <FormatBadge format={e.format} />
                        {e.purchase_date && (
                          <span className="text-xs text-slate-500">
                            {formatDate(e.purchase_date)}
                          </span>
                        )}
                        {e.purchase_price != null && (
                          <span className="text-xs font-medium text-slate-700">
                            NZD {e.purchase_price}
                          </span>
                        )}
                        {e.is_preorder && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Pre-order
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 pt-5 border-t border-slate-200">
            <button
              type="button"
              onClick={onDelete}
              disabled={del.isPending}
              className="text-xs text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 disabled:opacity-60"
            >
              <Trash2 className="h-3 w-3" />
              {del.isPending ? 'Deleting…' : 'Delete this store'}
            </button>
          </div>
        </>
      )}
    </>
  )
}
