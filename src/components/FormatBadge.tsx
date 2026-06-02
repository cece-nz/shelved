import {
  BookOpen,
  BookMarked,
  Tablet,
  Headphones,
  Sparkles,
  Book,
} from 'lucide-react'
import type { Format } from '../lib/database.types.ts'

export const FORMAT_META: Record<
  Format,
  { label: string; Icon: typeof BookOpen }
> = {
  paperback: { label: 'Paperback', Icon: BookOpen },
  hardcover: { label: 'Hardcover', Icon: BookMarked },
  ebook: { label: 'eBook', Icon: Tablet },
  audiobook: { label: 'Audiobook', Icon: Headphones },
  special_edition: { label: 'Special edition', Icon: Sparkles },
  other: { label: 'Other', Icon: Book },
}

export function FormatBadge({ format }: { format: Format }) {
  const { label, Icon } = FORMAT_META[format] ?? FORMAT_META.other
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}
