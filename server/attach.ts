import type { Connect } from 'vite'
import { lookupBkrs } from './bkrs'
import { synthesize } from './edge'

export function attachApi(middlewares: Connect.Server) {
  middlewares.use(async (req, res, next) => {
    const raw = req.url || ''
    if (!raw.startsWith('/api/dict') && !raw.startsWith('/api/tts')) {
      next()
      return
    }
    try {
      const url = new URL(raw, 'http://127.0.0.1')
      if (url.pathname === '/api/dict') {
        const items = await lookupBkrs(url.searchParams.get('q') || '')
        res.statusCode = 200
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.end(JSON.stringify({ items }))
        return
      }
      if (url.pathname !== '/api/tts') {
        next()
        return
      }
      const text = url.searchParams.get('text') || ''
      if (!text.trim()) {
        res.statusCode = 400
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'empty' }))
        return
      }
      const audio = await synthesize(text, Number(url.searchParams.get('rate') || '1'))
      res.statusCode = 200
      res.setHeader('content-type', 'audio/mpeg')
      res.setHeader('cache-control', 'private, max-age=86400')
      res.end(audio)
    } catch {
      if (!res.headersSent) {
        res.statusCode = 502
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'upstream' }))
      }
    }
  })
}
