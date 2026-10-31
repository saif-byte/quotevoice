const BASE = import.meta.env.BASE_URL

/** The 1-minute product video. Loads nothing until played, so the page stays fast. */
export function DemoVideo({ className = '', autoPlay = false }: { className?: string; autoPlay?: boolean }) {
  return (
    <figure className={`demo-video ${className}`}>
      <video
        controls
        playsInline
        preload={autoPlay ? 'auto' : 'none'}
        autoPlay={autoPlay}
        poster={`${BASE}media/quotevoice-demo-poster.jpg`}
        aria-label="QuoteVoice in one minute: a voice note becomes a priced quote the customer accepts online"
      >
        <source src={`${BASE}media/quotevoice-demo.mp4`} type="video/mp4" />
        Your browser can't play this video.
      </video>
      <figcaption>QuoteVoice in one minute</figcaption>
    </figure>
  )
}
