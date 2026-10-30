import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' makes all asset paths relative, so the same build works
// on GitHub Pages (https://<user>.github.io/<repo>/) and locally.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
} as never)
