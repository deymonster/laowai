import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import type { Connect } from 'vite'
import { attachApi } from './server/attach'

function strokeFiles(): Plugin {
  const root = join(process.cwd(), 'node_modules/hanzi-writer-data')
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    const raw = req.url || ''
    let pathname = ''
    try { pathname = decodeURIComponent(new URL(raw, 'http://127.0.0.1').pathname) } catch { next(); return }
    const match = pathname.match(/^\/strokes\/(.+)\.json$/)
    if (!match) { next(); return }
    const char = match[1]
    if ([...char].length !== 1 || !/\p{Script=Han}/u.test(char)) {
      res.statusCode = 404
      res.end()
      return
    }
    const file = join(root, `${char}.json`)
    if (!existsSync(file)) {
      res.statusCode = 404
      res.end()
      return
    }
    res.statusCode = 200
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'public, max-age=86400')
    createReadStream(file).pipe(res)
  }
  return {
    name: 'stroke-files',
    configureServer(server) { server.middlewares.use(serve) },
    configurePreviewServer(server) { server.middlewares.use(serve) },
  }
}

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
  plugins: [apiPlugin(), strokeFiles()],
})
