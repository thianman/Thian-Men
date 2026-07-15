import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages at https://<user>.github.io/Dodgeball-Project/
// the app needs to be served under the /Dodgeball-Project/ path.
// Locally (dev + `vite preview`) we want the root, so respect NODE_ENV.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/Dodgeball-Project/' : '/',
  server: { host: true, port: 5173 },
}))
