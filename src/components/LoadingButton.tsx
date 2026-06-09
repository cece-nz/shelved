import { Loader2, type LucideIcon } from 'lucide-react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean
  pendingLabel?: string
  icon?: LucideIcon
}

/** Submit/action button with spinner and disabled state while pending. */
export function LoadingButton({
  pending = false,
  pendingLabel,
  icon: Icon,
  children,
  disabled,
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const label = pending && pendingLabel ? pendingLabel : children
  return (
    <button
      type={type}
      disabled={disabled || pending}
      className={`inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${className}`}
      {...rest}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
      {Icon && !pending && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {label}
    </button>
  )
}
