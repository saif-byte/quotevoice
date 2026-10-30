import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Clickjacking guard: GitHub Pages can't send X-Frame-Options, so refuse to run inside a frame.
if (window.top !== window.self) {
  try {
    window.top!.location.href = window.self.location.href
  } catch {
    /* blocked by the framing page: render nothing below */
  }
  throw new Error('QuoteVoice does not run inside frames.')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
