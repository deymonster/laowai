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
let onActivity: (text: string) => void = () => {}
let active = ''
let pendingToken = 0
let systemBusy = false
let systemUntil = 0
let watchTimer = 0
let onSystemCut: () => void = () => {}

const COOL_MS = 45_000
const blobs = new Map<string, string>()
const warming = new Map<string, Promise<void>>()

export function setSpeakNotice(fn: (message: string) => void) {
  notice = fn
}

export function setSpeakActivity(fn: (text: string) => void) {
  onActivity = fn
}

export function speakingNow(): string {
  return active
}

function showSpeaking(text: string) {
  const changed = active !== text
  active = text
  if (text) armWatch()
  else if (watchTimer) {
    window.clearInterval(watchTimer)
    watchTimer = 0
  }
  if (changed) onActivity(text)
}

function armWatch() {
  if (watchTimer || typeof window === 'undefined') return
  watchTimer = window.setInterval(() => {
    poke()
    if (!active && watchTimer) {
      window.clearInterval(watchTimer)
      watchTimer = 0
    }
  }, 200)
}

function soundingAudio(): boolean {
  for (const audio of [edgeAudio, dictAudio, blobAudio]) {
    if (!audio || audio.paused || audio.ended || audio.muted || audio.volume <= 0) continue
    const src = audio.currentSrc || audio.src
    if (!src) continue
    // A clip that has not moved yet is not sound. Treating it as sound
    // cancelled the device voice and left the square button stuck.
    if (audio.currentTime <= 0) continue
    const duration = audio.duration
    if (Number.isFinite(duration) && duration > 0 && audio.currentTime >= duration - 0.03) continue
    return true
  }
  return false
}

function poke() {
  if (!active) return
  if (pendingToken !== 0 && pendingToken === token) return
  systemBusy = systemBusy && Date.now() <= systemUntil
  if (systemBusy || soundingAudio()) return
  showSpeaking('')
}

export function stopSpeak() {
  token += 1
  pendingToken = 0
  dropPlayers()
  silenceSystem()
  showSpeaking('')
}

function pickVoice() {
  if (!('speechSynthesis' in window)) return
  const list = speechSynthesis.getVoices()
  // Eddy, Flo, Grandpa and the other macOS novelty voices match zh-CN first and sound muffled.
  const usable = list.filter(item => !/^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i.test(item.name))
  const pool = usable.length ? usable : list
  voice = pool.find(item => /ting-?ting|婷婷|meijia|美佳|sinji|xiaoxiao|yunxi/i.test(item.name))
    || pool.find(item => /^zh[-_]CN/i.test(item.lang))
    || pool.find(item => /^zh/i.test(item.lang))
    || pool.find(item => /chinese|mandarin|中文|普通话/i.test(item.name))
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

function mount(kind: 'edge' | 'dict' | 'blob'): HTMLAudioElement {
  const previous = kind === 'edge' ? edgeAudio : kind === 'dict' ? dictAudio : blobAudio
  if (previous) {
    previous.onerror = null
    previous.onplaying = null
    try { previous.pause() } catch { /* already idle */ }
    previous.removeAttribute('src')
  }
  const audio = new Audio()
  audio.preload = 'auto'
  const settled = () => poke()
  audio.addEventListener('ended', settled)
  audio.addEventListener('pause', settled)
  if (kind === 'edge') edgeAudio = audio
  else if (kind === 'dict') dictAudio = audio
  else blobAudio = audio
  return audio
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
  systemBusy = false
  systemUntil = 0
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try { speechSynthesis.cancel() } catch { /* unavailable */ }
}

interface PendingClip {
  audio: HTMLAudioElement
  backup: boolean
  result: Promise<'ok' | 'stale' | 'fail'>
  promote: () => void
  stop: () => void
}

function beginClip(kind: 'edge' | 'dict' | 'blob', url: string, playbackRate: number, backup: boolean, timeoutMs: number, current: number, generation: number): PendingClip {
  const audio = mount(kind)
  let settled = false
  let probe = 0
  let resolve: (result: 'ok' | 'stale' | 'fail') => void = () => {}
  const result = new Promise<'ok' | 'stale' | 'fail'>(done => { resolve = done })
  const finish = (value: 'ok' | 'stale' | 'fail') => {
    if (settled) return
    settled = true
    window.clearTimeout(timer)
    window.clearTimeout(probe)
    audio.onerror = null
    audio.onplaying = null
    audio.onloadedmetadata = null
    audio.ondurationchange = null
    audio.onended = null
    audio.onvolumechange = null
    const live = current === token && generation === playGen
    if (!live || value !== 'ok') {
      audio.loop = false
      try { audio.pause() } catch { /* already idle */ }
      audio.removeAttribute('src')
    }
    resolve(live ? value : 'stale')
  }
  const heard = () => !audio.muted && audio.volume > 0
  const clipLength = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration
    if (audio.ended && Number.isFinite(audio.currentTime) && audio.currentTime > 0) return audio.currentTime
    return 0
  }
  const rejectIfShort = () => {
    if (!heard()) return false
    const length = clipLength()
    if (!(length > 0 && length < 0.2)) return false
    finish('fail')
    return true
  }
  const succeed = () => {
    if (settled || !heard() || audio.paused || audio.ended) return
    if (rejectIfShort()) return
    const length = clipLength()
    if (audio.currentTime > 0.02 && (length === 0 || length >= 0.2)) {
      finish('ok')
      return
    }
    if (probe) return
    const check = () => {
      probe = 0
      if (settled || !heard() || audio.paused || audio.ended) return
      if (rejectIfShort()) return
      if (audio.currentTime > 0.02) finish('ok')
      else probe = window.setTimeout(check, 200)
    }
    probe = window.setTimeout(check, 200)
  }
  const timer = window.setTimeout(() => finish('fail'), timeoutMs)
  audio.onerror = () => finish('fail')
  audio.onloadedmetadata = () => { rejectIfShort() }
  audio.ondurationchange = () => { rejectIfShort() }
  audio.onended = () => { rejectIfShort() }
  audio.onplaying = () => succeed()
  audio.onvolumechange = () => succeed()
  audio.muted = backup
  audio.volume = backup ? 0 : 1
  audio.loop = backup
  try { audio.playbackRate = playbackRate } catch { /* metadata is not ready yet */ }
  audio.src = url
  const started = audio.play()
  if (started) void started.catch(() => finish('fail'))
  return {
    audio,
    backup,
    result,
    promote() {
      if (settled) return
      audio.loop = false
      audio.muted = false
      audio.volume = 1
      try { if (audio.currentTime > 0.05) audio.currentTime = 0 } catch { /* not seekable yet */ }
      if (!audio.paused && !audio.ended) {
        succeed()
        return
      }
      const again = audio.play()
      if (again) void again.catch(() => finish('fail'))
    },
    stop() { finish('stale') },
  }
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
  systemBusy = true
  systemUntil = Date.now() + Math.min(25_000, 1600 + [...text].length * 700)
  const finishSystem = () => {
    if (generation !== systemGen) return
    systemBusy = false
    poke()
  }
  utterance.onend = finishSystem
  utterance.onerror = event => {
    if (generation !== systemGen) return
    // A remote clip can steal the audio session before it has made any sound.
    if (event.error === 'interrupted') onSystemCut()
    finishSystem()
  }
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

function remoteLost(spoke: boolean) {
  if (noticed) return
  noticed = true
  notice(spoke ? 'Серверный голос недоступен. Говорит голос устройства.' : 'Не удалось произнести.')
}

export async function speak(text: string, pinyin = '') {
  const clean = text.trim()
  if (!clean) return
  const current = ++token
  pendingToken = current
  dropPlayers()
  showSpeaking(clean)
  const rate = state.settings.rate || 1
  const mode = state.settings.voice
  let retried = false
  onSystemCut = () => {
    if (retried || token !== current) return
    retried = true
    window.setTimeout(() => {
      if (token !== current || soundingAudio()) return
      if (!('speechSynthesis' in window)) return
      if (speechSynthesis.speaking || speechSynthesis.pending) return
      speakSystem(clean, rate)
    }, 80)
  }
  try {
    if (mode === 'system') {
      speakSystem(clean, rate)
      return
    }
    const edgeOpen = !cooling(edgeDownUntil)
    const dictOpen = mode === 'dict' || !cooling(dictDownUntil)
    const cached = mode === 'dict' ? undefined : blobs.get(clipKey(clean, rate))
    // The device voice covers the wait. It is stopped only after a clip is audible.
    const spoke = speakSystem(clean, rate)
    if (!cached && !edgeOpen && !dictOpen) {
      remoteLost(spoke)
      return
    }
    const generation = playGen
    // Every play() runs before the first await, while the click still counts.
    // A backup stays muted so the faster male voice cannot cover Xiaoxiao.
    const clips: PendingClip[] = []
    if (cached) clips.push(beginClip('blob', cached, 1, false, 2000, current, generation))
    else if (mode !== 'dict' && edgeOpen) clips.push(beginClip('edge', edgeUrl(clean, pinyin, rate), 1, false, 3600, current, generation))
    else if (dictOpen) clips.push(beginClip('dict', dictUrl(clean), rate, false, 2500, current, generation))
    const dictStarted = clips.some(clip => clip.audio === dictAudio)
    if (dictOpen && !dictStarted) clips.push(beginClip('dict', dictUrl(clean), rate, true, 7000, current, generation))
    if (mode === 'dict' && edgeOpen && !clips.some(clip => clip.audio === edgeAudio)) {
      clips.push(beginClip('edge', edgeUrl(clean, pinyin, rate), 1, true, 3600, current, generation))
    }
    let won = false
    for (const clip of clips) {
      if (current !== token) return
      if (clip.backup) clip.promote()
      const result = await clip.result
      if (current !== token || result === 'stale') return
      if (result === 'ok') {
        const remote = clip.audio === edgeAudio || clip.audio === blobAudio
        if (remote) edgeDownUntil = 0
        if (clip.audio === dictAudio) dictDownUntil = 0
        for (const other of clips) if (other !== clip) other.stop()
        silenceSystem()
        won = true
        break
      }
      if (clip.audio === edgeAudio) edgeDownUntil = Date.now() + COOL_MS
      if (clip.audio === dictAudio) dictDownUntil = Date.now() + COOL_MS
    }
    if (!won && current === token) {
      if ('speechSynthesis' in window && !speechSynthesis.speaking && !speechSynthesis.pending) speakSystem(clean, rate)
      remoteLost(spoke)
    }
  } finally {
    if (onSystemCut) onSystemCut = () => {}
    if (pendingToken === current) pendingToken = 0
    if (token === current) poke()
  }
}
