import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // El plugin de Tailwind v4 se integra directamente en Vite,
  // intercepta el CSS y compila las clases que realmente usas
  plugins: [react(), tailwindcss()],

  // jsPDF y jspdf-autotable son módulos CJS; Vite necesita
  // pre-bundlearlos para que el import nombrado { jsPDF } funcione
  // correctamente en producción (evita el error "Sz.default is not a function")
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'],
  },
  build: {
    commonjsOptions: {
      include: [/jspdf/, /jspdf-autotable/, /node_modules/],
      transformMixedEsModules: true,
    },
  },

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
      '/dashboard': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
