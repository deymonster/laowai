import { state } from './store'

let audio: HTMLAudioElement | null = null
let voice: SpeechSynthesisVoice | null = null
let dictFails = 0
let edgeFails = 0
let token = 0
let noticed = false
let notice: (message: string) => void = () => {}

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

function getAudio() {
  audio ??= new Audio()
  return audio
}

function playUrl(url: string, playbackRate: number, timeoutMs = 2800): Promise<void> {
  return new Promise((resolve, reject) => {
    const player = getAudio()
    let settled = false
    let probe = 0
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.clearTimeout(probe)
      player.onerror = null
      player.onplaying = null
      player.onloadedmetadata = null
      player.ondurationchange = null
      player.onended = null
      fn()
    }
    const timer = window.setTimeout(() => finish(() => reject(new Error('timeout'))), timeoutMs)
    const clipLength = () => {
      if (Number.isFinite(player.duration) && player.duration > 0) return player.duration
      if (player.ended && Number.isFinite(player.currentTime) && player.currentTime > 0) return player.currentTime
      return 0
    }
    const rejectIfShort = () => {
      const length = clipLength()
      if (!(length > 0 && length < 0.2)) return false
      try { player.pause() } catch { /* already stopped */ }
      finish(() => reject(new Error('short')))
      return true
    }
    player.onerror = () => finish(() => reject(new Error('audio')))
    player.onloadedmetadata = () => { rejectIfShort() }
    player.ondurationchange = () => { rejectIfShort() }
    player.onended = () => { rejectIfShort() }
    player.onplaying = () => {
      if (rejectIfShort()) return
      if (clipLength() >= 0.2) {
        finish(() => resolve())
        return
      }
      probe = window.setTimeout(() => {
        if (settled) return
        if (rejectIfShort()) return
        finish(() => resolve())
      }, 250)
    }
    try { player.pause() } catch { /* already idle */ }
    player.src = url
    player.playbackRate = playbackRate
    player.play().catch(error => finish(() => reject(error)))
  })
}

function speakSystem(text: string, rate: number): boolean {
  if (!('speechSynthesis' in window)) return false
  pickVoice()
  const utterance = new SpeechSynthesisUtterance(text.replace(/[…（）()]/g, ''))
  utterance.lang = voice?.lang || 'zh-CN'
  if (voice) utterance.voice = voice
  utterance.rate = Math.max(0.4, Math.min(1.6, 0.92 * rate))
  speechSynthesis.cancel()
  speechSynthesis.speak(utterance)
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

async function tryPlay(url: string, playbackRate: number, timeoutMs: number, current: number): Promise<'ok' | 'stale' | 'fail'> {
  if (current !== token) return 'stale'
  try {
    await playUrl(url, playbackRate, timeoutMs)
    return current === token ? 'ok' : 'stale'
  } catch {
    return current === token ? 'fail' : 'stale'
  }
}

export async function speak(text: string, pinyin = '') {
  const clean = text.trim()
  if (!clean) return
  const current = ++token
  const rate = state.settings.rate || 1
  const mode = state.settings.voice
  if (current !== token) return
  const wantEdge = mode !== 'system' && edgeFails < 2
  const wantDict = mode !== 'system' && (mode === 'dict' || dictFails < 2)
  const order: ('edge' | 'dict')[] = mode === 'dict' ? ['dict', 'edge'] : ['edge', 'dict']
  for (const source of order) {
    if (current !== token) return
    if (source === 'edge' && wantEdge) {
      const result = await tryPlay(edgeUrl(clean, pinyin, rate), 1, 7000, current)
      if (result === 'ok') { edgeFails = 0; return }
      if (result === 'stale') return
      edgeFails++
    }
    if (source === 'dict' && wantDict) {
      const result = await tryPlay(dictUrl(clean), rate, 2800, current)
      if (result === 'ok') { dictFails = 0; return }
      if (result === 'stale') return
      dictFails++
    }
  }
  if (current !== token) return
  const spoke = speakSystem(clean, rate)
  if (mode !== 'system' && !noticed) {
    noticed = true
    notice(spoke ? 'Серверный голос недоступен. Говорит голос устройства.' : 'Не удалось произнести.')
  }
}
