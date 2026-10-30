import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Content Security Policy for the built site. GitHub Pages can't send security headers,
 * so it goes in a <meta> tag. Production only: Vite's dev server needs an inline script.
 * It means the page only runs its own scripts and only talks to Supabase and Gemini,
 * so injected markup can't load code or send data anywhere else.
 */
function contentSecurityPolicy(supabaseUrl: string): Plugin {
  const host = new URL(supabaseUrl).host
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' https://${host} wss://${host} https://generativelanguage.googleapis.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self'",
  ].join('; ')
  return {
    name: 'quotevoice-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
  }
}

// base: './' makes all asset paths relative, so the same build works
// on GitHub Pages (https://<user>.github.io/<repo>/) and locally.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: './',
    plugins: [react(), contentSecurityPolicy(env.VITE_SUPABASE_URL || 'https://vmyxhleijilablgbdvny.supabase.co')],
    test: {
      environment: 'node',
    },
  }
})
