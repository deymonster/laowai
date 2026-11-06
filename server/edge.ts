import { EdgeTTS } from 'node-edge-tts'

const cache = new Map<string, Buffer>()

export function edgeRate(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0.9) return '-25%'
  if (rate >= 1.4) return '+50%'
  if (rate >= 1.1) return '+25%'
  return '+0%'
}

function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 180)
}

export async function synthesize(text: string, rate: number): Promise<Buffer> {
  const clean = cleanText(text)
  if (!clean) throw new Error('empty')
  const speed = edgeRate(rate)
  const key = `${speed}\n${clean}`
  const hit = cache.get(key)
  if (hit) return hit
  const tts = new EdgeTTS({
    voice: 'zh-CN-XiaoxiaoNeural',
    lang: 'zh-CN',
    rate: speed,
    timeout: 6000,
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  })
  const parts: Buffer[] = []
  for await (const chunk of tts.streamAudio(clean)) {
    if (Buffer.isBuffer(chunk)) parts.push(chunk)
  }
  const audio = Buffer.concat(parts)
  if (audio.length < 128) throw new Error('short')
  cache.set(key, audio)
  if (cache.size > 100) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  return audio
}
