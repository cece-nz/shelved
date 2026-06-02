import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { getCoverUrl } from '../lib/storage.ts'

/**
 * A book cover image. Falls back to a stylized title placeholder when
 * the path is null OR when the image fails to load (e.g. Storage 404).
 *
 * The container is shaped by the `className` prop — pass any
 * Tailwind sizing/aspect classes you like:
 *   <Cover ... className="w-28 h-40" />
 *   <Cover ... className="aspect-[2/3] w-full" />
 *
 * Pass `version` (typically the book's `updated_at`) to cache-bust the
 * image URL so re-uploads show immediately.
 */
export function Cover({
  path,
  title,
  authors,
  version,
  className = '',
}: {
  path: string | null
  title: string
  authors?: string[]
  version?: string | null
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const url = getCoverUrl(path, version)

  if (!url || failed) {
    return <PlaceholderCover title={title} authors={authors} className={className} />
  }

  return (
    <img
      src={url}
      alt={`Cover of ${title}`}
      onError={() => setFailed(true)}
      className={`object-cover rounded-md bg-slate-100 ${className}`}
    />
  )
}

/**
 * Stylized "no cover" block: book title (+ author when given) on a
 * pastel background whose hue is derived from the title so each book
 * gets its own consistent color.
 */
function PlaceholderCover({
  title,
  authors,
  className,
}: {
  title: string
  authors?: string[]
  className: string
}) {
  const hue = hashHue(title)
  return (
    <div
      style={{
        background: `hsl(${hue}, 32%, 92%)`,
        color: `hsl(${hue}, 45%, 28%)`,
      }}
      className={`rounded-md flex flex-col items-center justify-center p-2 text-center overflow-hidden ${className}`}
    >
      <BookOpen className="h-5 w-5 opacity-50 mb-1.5 shrink-0" />
      <p className="text-[10px] font-semibold leading-tight line-clamp-3">
        {title}
      </p>
      {authors && authors.length > 0 && (
        <p className="text-[9px] mt-1 opacity-70 line-clamp-1">
          {authors[0]}
        </p>
      )}
    </div>
  )
}

function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 360
}
