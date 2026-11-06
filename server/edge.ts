import { EdgeTTS } from 'node-edge-tts'
import { assertEdgeOpen, edgeRate, noteEdgeFailure, noteEdgeSuccess } from './edge-policy'

const cache = new Map<string, Buffer>()
const inflight = new Map<string, Promise<Buffer>>()
const EDGE_TIMEOUT_MS = 2500

export { edgeRate } from './edge-policy'

function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 180)
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    work.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}

async function readEdge(clean: string, speed: string): Promise<Buffer> {
  const tts = new EdgeTTS({
    voice: 'zh-CN-XiaoxiaoNeural',
    lang: 'zh-CN',
    rate: speed,
    timeout: EDGE_TIMEOUT_MS,
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  })
  const parts: Buffer[] = []
  for await (const chunk of tts.streamAudio(clean)) {
    if (Buffer.isBuffer(chunk)) parts.push(chunk)
  }
  const audio = Buffer.concat(parts)
  if (audio.length < 128) throw new Error('short')
  return audio
}

function remember(key: string, audio: Buffer) {
  cache.set(key, audio)
  if (cache.size > 100) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

export async function synthesize(text: string, rate: number): Promise<Buffer> {
  const clean = cleanText(text)
  if (!clean) throw new Error('empty')
  const speed = edgeRate(rate)
  const key = `${speed}\n${clean}`
  const hit = cache.get(key)
  if (hit) return hit
  const pending = inflight.get(key)
  if (pending) return pending
  // A cached clip still plays. A fresh Edge call does not, until the cool-down ends.
  assertEdgeOpen()
  const job = (async () => {
    const work = readEdge(clean, speed)
    try {
      const audio = await withTimeout(work, EDGE_TIMEOUT_MS)
      noteEdgeSuccess()
      remember(key, audio)
      return audio
    } catch (error) {
      noteEdgeFailure()
      void work.then(audio => {
        noteEdgeSuccess()
        remember(key, audio)
      }).catch(() => {})
      throw error
    }
  })().finally(() => { inflight.delete(key) })
  inflight.set(key, job)
  return job
}
