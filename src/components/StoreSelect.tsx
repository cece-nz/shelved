import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useStores, useAddStore } from '../queries/stores.ts'

/**
 * Controlled store picker (value / onChange) with an inline "create store"
 * affordance. Used wherever an edition's store is set outside of a
 * react-hook-form context (e.g. the book page's edit-edition form).
 */
export function StoreSelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (storeId: string) => void
  className?: string
}) {
  const { data: stores = [] } = useStores()
  const add = useAddStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const onAdd = async () => {
    const n = name.trim()
    if (!n) {
      setAdding(false)
      return
    }
    const store = await add.mutateAsync({ name: n })
    setName('')
    setAdding(false)
    onChange(store.id)
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs bg-white"
        >
          <option value="">Not set</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[10px] rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New store name"
            autoFocus
            className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={add.isPending || !name.trim()}
            className="text-[10px] rounded-full bg-teal-500 hover:bg-teal-600 text-white px-2.5 py-1 disabled:opacity-60"
          >
            {add.isPending ? '…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setName('')
            }}
            className="text-[10px] text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
