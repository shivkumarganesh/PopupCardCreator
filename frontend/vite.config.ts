import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base: the same build works on GitHub Pages and as an uploaded Atomm artifact.
export default defineConfig({
  base: './',
  plugins: [react()],
})
