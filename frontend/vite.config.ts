import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages project path: username.github.io/PopupCardCreator/
export default defineConfig({
  base: '/PopupCardCreator/',
  plugins: [react()],
})
