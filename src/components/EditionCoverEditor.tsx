import { useState } from 'react'
import { Image as ImageIcon, Upload } from 'lucide-react'
import {
  useSetEditionCoverFromFile,
  useSetEditionCoverFromUrl,
  useClearEditionCover,
} from '../queries/editions.ts'
import { LoadingButton } from './LoadingButton.tsx'

type Props = {
  editionId: string
  bookId: string
  hasEditionCover: boolean
}

/** Upload file or paste URL for a per-edition cover. */
export function EditionCoverEditor({
  editionId,
  bookId,
  hasEditionCover,
}: Props) {
  const [mode, setMode] = useState<'collapsed' | 'open' | 'url'>(
    hasEditionCover ? 'collapsed' : 'open',
  )
  const [url, setUrl] = useState('')
  const setFromFile = useSetEditionCoverFromFile(editionId, bookId)
  const setFromUrl = useSetEditionCoverFromUrl(editionId, bookId)
  const clearCover = useClearEditionCover(editionId, bookId)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await setFromFile.mutateAsync(file)
      e.target.value = ''
      setMode('collapsed')
    } catch {
      /* mutation error below */
    }
  }

  const onUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    try {
      await setFromUrl.mutateAsync(trimmed)
      setUrl('')
      setMode('collapsed')
    } catch {
      /* mutation error below */
    }
  }

  if (mode === 'collapsed') {
    return (
      <button
        type="button"
        onClick={() => setMode('open')}
        className="text-[10px] text-teal-600 hover:text-teal-700 inline-flex items-center gap-0.5"
      >
        <ImageIcon className="h-3 w-3" />
        Cover
      </button>
    )
  }

  return (
    <div className="space-y-1">
      <label className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-500 hover:bg-teal-600 text-white cursor-pointer w-fit">
        <Upload className="h-3 w-3" />
        {setFromFile.isPending ? '…' : 'Upload'}
        <input
          type="file"
          accept="image/*"
          onChange={onFile}
          disabled={setFromFile.isPending}
          className="hidden"
        />
      </label>
      {mode === 'open' ? (
        <button
          type="button"
          onClick={() => setMode('url')}
          className="block text-[10px] text-slate-500 hover:text-slate-700 underline"
        >
          or URL
        </button>
      ) : (
        <form onSubmit={onUrlSubmit} className="flex flex-wrap gap-1 items-center">
          <input
            type="url"
            placeholder="Image URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-0.5 text-[10px]"
          />
          <LoadingButton
            type="submit"
            pending={setFromUrl.isPending}
            pendingLabel="…"
            disabled={!url.trim()}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-500 hover:bg-teal-600 text-white"
          >
            Save
          </LoadingButton>
        </form>
      )}
      {hasEditionCover && (
        <button
          type="button"
          onClick={() => clearCover.mutate()}
          disabled={clearCover.isPending}
          className="block text-[10px] text-slate-500 hover:text-slate-700"
        >
          {clearCover.isPending ? '…' : 'Use book cover'}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setMode('collapsed')
          setUrl('')
        }}
        className="block text-[10px] text-slate-400"
      >
        Cancel
      </button>
      {(setFromFile.error || setFromUrl.error) && (
        <p className="text-[10px] text-rose-600">
          {(setFromFile.error ?? setFromUrl.error)!.message}
        </p>
      )}
    </div>
  )
}
