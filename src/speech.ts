import { state } from './store'

let voice: SpeechSynthesisVoice | null = null
let token = 0
let playGen = 0
let systemGen = 0
let noticed = false
let edgeDownUntil = 0
let dictDownUntil = 0
let edgeAudio: HTMLAudioElement | null = null
let dictAudio: HTMLAudioElement | null = null
let blobAudio: HTMLAudioElement | null = null
let notice: (message: string) => void = () => {}

const COOL_MS = 45_000
const blobs = new Map<string, string>()
const warming = new Map<string, Promise<void>>()

export function setSpeakNotice(fn: (message: string) => void) {
  notice = fn
}

function pickVoice() {
  if (!('speechSynthesis' in window)) return
  const list = speechSynthesis.getVoices()
  voice = list.find(item => /^zh[-_]CN/i.test(item.lang))
    || list.find(item => /^zh/i.test(item.lang))
    || list.find(item => /chinese|mandarin|ting|xiaoxiao|yunxi|中文|普通话/i.test(item.name))
    || null
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice()
  speechSynthesis.addEventListener('voiceschanged', pickVoice)
}

function clipKey(text: string, rate: number): string {
  return `${rate}\n${text}`
}

function cooling(until: number): boolean {
  return Date.now() < until
}

function player(kind: 'edge' | 'dict' | 'blob'): HTMLAudioElement {
  if (kind === 'edge') return edgeAudio ??= new Audio()
  if (kind === 'dict') return dictAudio ??= new Audio()
  return blobAudio ??= new Audio()
}

function drop(audio: HTMLAudioElement | null) {
  if (!audio) return
  audio.onerror = null
  audio.onplaying = null
  audio.onloadedmetadata = null
  audio.ondurationchange = null
  audio.onended = null
  try { audio.pause() } catch { /* already idle */ }
  audio.src = ''
}

function dropPlayers() {
  playGen += 1
  drop(edgeAudio)
  drop(dictAudio)
  drop(blobAudio)
}

function silenceSystem() {
  systemGen += 1
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try { speechSynthesis.cancel() } catch { /* unavailable */ }
}

function playOn(audio: HTMLAudioElement, url: string, playbackRate: number, timeoutMs: number, current: number, generation: number): Promise<'ok' | 'stale' | 'fail'> {
  return new Promise(resolve => {
    if (current !== token || generation !== playGen) {
      resolve('stale')
      return
    }
    let settled = false
    let probe = 0
    const finish = (result: 'ok' | 'stale' | 'fail') => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.clearTimeout(probe)
      audio.onerror = null
      audio.onplaying = null
      audio.onloadedmetadata = null
      audio.ondurationchange = null
      audio.onended = null
      const live = current === token && generation === playGen
      if (!live || result !== 'ok') {
        try { audio.pause() } catch { /* already idle */ }
      }
      resolve(live ? result : 'stale')
    }
    const timer = window.setTimeout(() => finish('fail'), timeoutMs)
    const clipLength = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration
      if (audio.ended && Number.isFinite(audio.currentTime) && audio.currentTime > 0) return audio.currentTime
      return 0
    }
    const rejectIfShort = () => {
      const length = clipLength()
      if (!(length > 0 && length < 0.2)) return false
      finish('fail')
      return true
    }
    audio.onerror = () => finish('fail')
    audio.onloadedmetadata = () => { rejectIfShort() }
    audio.ondurationchange = () => { rejectIfShort() }
    audio.onended = () => { rejectIfShort() }
    audio.onplaying = () => {
      if (rejectIfShort()) return
      if (clipLength() >= 0.2) {
        finish('ok')
        return
      }
      probe = window.setTimeout(() => {
        if (settled) return
        if (rejectIfShort()) return
        finish('ok')
      }, 250)
    }
    try { audio.pause() } catch { /* already idle */ }
    audio.src = url
    audio.playbackRate = playbackRate
    const started = audio.play()
    if (started) void started.catch(() => finish('fail'))
  })
}

function speakSystem(text: string, rate: number): boolean {
  if (!('speechSynthesis' in window)) return false
  pickVoice()
  const utterance = new SpeechSynthesisUtterance(text.replace(/[…（）()]/g, ''))
  utterance.lang = voice?.lang || 'zh-CN'
  if (voice) utterance.voice = voice
  utterance.rate = Math.max(0.4, Math.min(1.6, 0.92 * rate))
  const synth = window.speechSynthesis
  const generation = ++systemGen
  const say = () => {
    if (generation !== systemGen) return
    synth.speak(utterance)
  }
  // Chrome drops speak() in the same turn as cancel(). The first click has
  // nothing to cancel, so the voice starts inside the user gesture.
  if (synth.speaking || synth.pending) {
    synth.cancel()
    window.setTimeout(say, 40)
  } else {
    say()
  }
  return true
}

function dictUrl(text: string): string {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`
}

export function voiceLabel(): string {
  pickVoice()
  if (!('speechSynthesis' in window)) return 'в этом браузере нет speechSynthesis'
  return voice ? `${voice.name} · ${voice.lang}` : 'системный голос zh-CN ещё не загрузился'
}

function edgeUrl(text: string, pinyin: string, rate: number): string {
  return `/api/tts?text=${encodeURIComponent(text)}&py=${encodeURIComponent(pinyin)}&rate=${encodeURIComponent(String(rate))}`
}

function rememberBlob(key: string, url: string) {
  const previous = blobs.get(key)
  if (previous) URL.revokeObjectURL(previous)
  blobs.delete(key)
  blobs.set(key, url)
  while (blobs.size > 12) {
    const oldest = blobs.keys().next().value
    if (!oldest) break
    const stale = blobs.get(oldest)
    if (stale) URL.revokeObjectURL(stale)
    blobs.delete(oldest)
  }
}

export function warm(text: string, pinyin = '') {
  const clean = text.trim()
  if (!clean || state.settings.voice === 'system' || cooling(edgeDownUntil)) return
  const rate = state.settings.rate || 1
  const key = clipKey(clean, rate)
  if (blobs.has(key) || warming.has(key)) return
  const job = fetch(edgeUrl(clean, pinyin, rate))
    .then(async response => {
      const type = response.headers.get('content-type') || ''
      if (!response.ok || !type.includes('audio')) throw new Error('status')
      const data = await response.blob()
      if (data.size < 128) throw new Error('short')
      rememberBlob(key, URL.createObjectURL(data))
      edgeDownUntil = 0
    })
    .catch(() => {
      edgeDownUntil = Date.now() + COOL_MS
    })
    .finally(() => { warming.delete(key) })
  warming.set(key, job)
}

type Source = 'edge' | 'dict'

function firstPlaying(jobs: Promise<Source | null>[]): Promise<Source | null> {
  if (!jobs.length) return Promise.resolve(null)
  return new Promise(resolve => {
    let left = jobs.length
    let settled = false
    for (const job of jobs) {
      void job.then(source => {
        if (settled) return
        if (source) {
          settled = true
          resolve(source)
          return
        }
        left -= 1
        if (left === 0) resolve(null)
      })
    }
  })
}

function remoteLost(spoke: boolean) {
  if (noticed) return
  noticed = true
  notice(spoke ? 'Серверный голос недоступен. Говорит голос устройства.' : 'Не удалось произнести.')
}

export async function speak(text: string, pinyin = '') {
  const clean = text.trim()
  if (!clean) return
  const current = ++token
  dropPlayers()
  const rate = state.settings.rate || 1
  const mode = state.settings.voice
  if (mode === 'system') {
    speakSystem(clean, rate)
    return
  }
  const key = clipKey(clean, rate)
  const ready = blobs.get(key)
  if (ready) {
    silenceSystem()
    const played = await playOn(player('blob'), ready, 1, 1500, current, playGen)
    if (played !== 'fail' || current !== token) return
  }
  if (current !== token) return
  const edgeOpen = !cooling(edgeDownUntil)
  const dictOpen = mode === 'dict' || !cooling(dictDownUntil)
  const spoke = speakSystem(clean, rate)
  if (!edgeOpen && !dictOpen) {
    remoteLost(spoke)
    return
  }
  const generation = playGen
  const jobs: Promise<Source | null>[] = []
  if (edgeOpen) {
    jobs.push(playOn(player('edge'), edgeUrl(clean, pinyin, rate), 1, 1600, current, generation).then(result => {
      if (result === 'ok') { edgeDownUntil = 0; return 'edge' as const }
      if (result === 'fail') edgeDownUntil = Date.now() + COOL_MS
      return null
    }))
  }
  if (dictOpen) {
    jobs.push(playOn(player('dict'), dictUrl(clean), rate, 1200, current, generation).then(result => {
      if (result === 'ok') { dictDownUntil = 0; return 'dict' as const }
      if (result === 'fail') dictDownUntil = Date.now() + COOL_MS
      return null
    }))
  }
  const winner = await firstPlaying(jobs)
  if (current !== token) return
  if (!winner) {
    remoteLost(spoke)
    return
  }
  playGen += 1
  drop(winner === 'edge' ? dictAudio : edgeAudio)
  silenceSystem()
}
