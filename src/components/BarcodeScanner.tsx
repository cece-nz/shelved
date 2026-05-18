import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onDetected: (isbn: string) => void
}

/**
 * Full-screen camera sheet that decodes book barcodes (EAN-13 / UPC-A
 * / occasionally ISBN-10) via ZXing and calls `onDetected` with the
 * code as soon as it sees one that looks like an ISBN.
 *
 * Camera lifecycle is managed by the effect:
 *   - On open, request the rear camera (`facingMode: environment`)
 *     and start continuous decode against the <video> element.
 *   - On close (or unmount, or detection), call controls.stop() to
 *     release the camera. Skipping this leaves the indicator light on
 *     and drains battery.
 */
export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectedRef = useRef(onDetected)
  const [error, setError] = useState<string | null>(null)

  // Keep latest callback in a ref so the camera effect doesn't restart
  // when the parent re-renders.
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  useEffect(() => {
    if (!open) return

    setError(null)
    const reader = new BrowserMultiFormatReader()
    let controls: { stop: () => void } | null = null
    let stopped = false

    ;(async () => {
      try {
        if (!videoRef.current) return
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result) => {
            if (!result || stopped) return
            const text = result.getText()
            if (isLikelyIsbn(text)) {
              stopped = true
              controls?.stop()
              onDetectedRef.current(normalizeToIsbn13(text))
            }
          },
        )
      } catch (e) {
        const err = e as Error
        if (err.name === 'NotAllowedError') {
          setError(
            'Camera permission was denied. Allow camera access in your browser to scan.',
          )
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.')
        } else {
          setError(err.message)
        }
      }
    })()

    return () => {
      stopped = true
      controls?.stop()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black flex flex-col"
        >
          <div className="flex justify-between items-center p-4 text-white">
            <span className="text-sm">Point camera at book barcode</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close scanner"
              className="p-1 -m-1"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
            />
            {/* Viewfinder guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4/5 max-w-sm h-32 border-2 border-white/70 rounded-md" />
            </div>
            {error && (
              <div className="absolute inset-x-4 bottom-8 p-3 bg-red-600/90 text-white text-sm rounded-md">
                {error}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Match ISBN-13 (978/979 prefix) or ISBN-10 patterns. */
function isLikelyIsbn(text: string): boolean {
  const clean = text.replace(/[\s-]/g, '')
  if (/^97[89]\d{10}$/.test(clean)) return true
  if (/^\d{9}[\dXx]$/.test(clean)) return true
  return false
}

/**
 * Most book barcodes are already EAN-13 (= ISBN-13). Old books may
 * scan as ISBN-10; Open Library handles both, so we just hand the raw
 * digits through after stripping separators.
 */
function normalizeToIsbn13(text: string): string {
  return text.replace(/[\s-]/g, '').toUpperCase()
}
