import { defineConfig, type Plugin } from 'vite'
import { attachApi } from './server/attach'

function apiPlugin(): Plugin {
  return {
    name: 'zici-api',
    configureServer(server) {
      attachApi(server.middlewares)
    },
    configurePreviewServer(server) {
      attachApi(server.middlewares)
    },
  }
}

export default defineConfig({
  server: { port: 5173, strictPort: true, host: '127.0.0.1' },
  preview: {
    port: 4173,
    host: '127.0.0.1',
    allowedHosts: ['laowai.deymonster.win'],
  },
  build: { target: 'es2022' },
  plugins: [apiPlugin()],
})
