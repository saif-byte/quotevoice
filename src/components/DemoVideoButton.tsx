import { useEffect, useRef, useState } from 'react'
import { DemoVideo } from './DemoVideo'

/** "Watch the 1-min video" button that opens the product video in a pop-up. */
export function DemoVideoButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        ▶ Watch the 1-min video
      </button>
      <dialog
        ref={ref}
        className="video-dialog"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        aria-label="QuoteVoice in one minute"
      >
        {open && (
          <>
            <button type="button" className="icon-btn video-close" aria-label="Close video" onClick={() => setOpen(false)}>
              ×
            </button>
            <DemoVideo autoPlay />
          </>
        )}
      </dialog>
    </>
  )
}
