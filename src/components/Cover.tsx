import { getCoverUrl } from '../lib/storage.ts'

/**
 * A book cover image. Falls back to a "No cover" placeholder when
 * the path is null OR when the image fails to load (e.g. Storage 404).
 *
 * The container is shaped by the `className` prop — pass any
 * Tailwind sizing/aspect classes you like, e.g.
 *   <Cover ... className="w-28 h-40" />
 *   <Cover ... className="aspect-[2/3] w-full" />
 */
import { useState } from 'react'

export function Cover({
  path,
  title,
  className = '',
}: {
  path: string | null
  title: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const url = getCoverUrl(path)

  if (!url || failed) {
    return (
      <div
        className={`bg-stone-100 rounded flex items-center justify-center text-[10px] text-stone-400 ${className}`}
      >
        No cover
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={`Cover of ${title}`}
      onError={() => setFailed(true)}
      className={`object-cover rounded bg-stone-100 ${className}`}
    />
  )
}
