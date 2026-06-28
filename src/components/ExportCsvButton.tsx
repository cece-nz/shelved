import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportBooksToCsv } from '../lib/exportBooks.ts'
import { LoadingButton } from './LoadingButton.tsx'

type Props = {
  className?: string
  label?: string
  onSuccess?: (rowCount: number) => void
}

/** Trigger a CSV download of the full library. */
export function ExportCsvButton({
  className = '',
  label = 'Export CSV',
  onSuccess,
}: Props) {
  const [exporting, setExporting] = useState(false)

  const onExport = async () => {
    setExporting(true)
    try {
      const count = await exportBooksToCsv()
      onSuccess?.(count)
    } catch (err) {
      window.alert(
        `Export failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <LoadingButton
      type="button"
      onClick={onExport}
      pending={exporting}
      pendingLabel="Exporting…"
      icon={Download}
      className={className}
    >
      {label}
    </LoadingButton>
  )
}
