import { forwardRef, useId } from 'react'

/**
 * A text input wired to a native <datalist> so the browser offers
 * autocomplete suggestions from values you've already used. Works both
 * with controlled inputs (value / onChange) and with react-hook-form
 * (spread {...register('field')}), since the ref is forwarded.
 *
 * Suggestions are advisory — the user can still type anything.
 */
export const AutofillInput = forwardRef<
  HTMLInputElement,
  { options: string[] } & React.InputHTMLAttributes<HTMLInputElement>
>(function AutofillInput({ options, ...props }, ref) {
  const id = useId()
  return (
    <>
      <input ref={ref} {...props} list={id} />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
})
