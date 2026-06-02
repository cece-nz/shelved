import { Star, StarHalf, X } from 'lucide-react'

/**
 * Five-star rating widget supporting 0.5 increments.
 *
 * Each star has two invisible button halves so clicking the left half
 * sets a .5 rating, clicking the right half sets a whole rating. A
 * small × on the end clears the rating.
 *
 * Pass `onChange` for interactive use; omit for a read-only display.
 */
export function StarRating({
  value,
  onChange,
  size = 'md',
}: {
  value: number | null
  onChange?: (v: number | null) => void
  size?: 'sm' | 'md' | 'lg'
}) {
  const v = value ?? 0
  const interactive = Boolean(onChange)
  const iconSize =
    size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'

  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const isFull = v >= i
        const isHalf = !isFull && v >= i - 0.5
        return (
          <span key={i} className="relative inline-flex">
            {isFull ? (
              <Star
                className={`${iconSize} text-amber-500`}
                fill="currentColor"
                strokeWidth={1.5}
              />
            ) : isHalf ? (
              <StarHalf
                className={`${iconSize} text-amber-500`}
                fill="currentColor"
                strokeWidth={1.5}
              />
            ) : (
              <Star
                className={`${iconSize} text-slate-300`}
                strokeWidth={1.5}
              />
            )}
            {interactive && (
              <>
                <button
                  type="button"
                  aria-label={`Set rating to ${i - 0.5}`}
                  onClick={() => onChange!(i - 0.5)}
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                />
                <button
                  type="button"
                  aria-label={`Set rating to ${i}`}
                  onClick={() => onChange!(i)}
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                />
              </>
            )}
          </span>
        )
      })}
      {interactive && value != null && (
        <button
          type="button"
          onClick={() => onChange!(null)}
          aria-label="Clear rating"
          className="ml-1 p-0.5 text-slate-400 hover:text-slate-700"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
