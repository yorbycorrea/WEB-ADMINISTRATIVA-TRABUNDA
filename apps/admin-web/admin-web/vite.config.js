import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // El plugin de Tailwind v4 se integra directamente en Vite,
  // intercepta el CSS y compila las clases que realmente usas
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Cualquier petición que empiece con /api o /auth
      // se redirige al Gateway en lugar de ir al navegador
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/services': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
