import { todayLocal } from '../lib/dates.ts'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'max'>

/** Date picker limited to today and earlier (local timezone). */
export function PastDateInput({ className = '', ...rest }: Props) {
  return (
    <input
      type="date"
      max={todayLocal()}
      className={className}
      {...rest}
    />
  )
}
