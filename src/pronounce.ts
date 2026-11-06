import { syllableAt } from './pinyin'

export type DiffPiece = { text: string; bad: boolean; expect: string; at: number }
export type SayFix = { kind: 'swap' | 'miss' | 'extra'; heard: string; hanzi: string; py: string }

export function hanPlain(text: string): string {
  return text.replace(/[^\p{Script=Han}]/gu, '')
}

export function alignHeard(target: string, heard: string): DiffPiece[] {
  const a = [...hanPlain(target)]
  const b = [...hanPlain(heard)]
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i++) dp[i][0] = i
  for (let j = 0; j <= m; j++) dp[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const swap = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + swap)
    }
  }
  const rev: DiffPiece[] = []
  let i = n
  let j = m
  // Равная цена: сначала хвост эталона, чтобы услышанное осталось напротив начала фразы.
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      rev.push({ text: b[j - 1], bad: false, expect: a[i - 1], at: i - 1 })
      i -= 1
      j -= 1
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      rev.push({ text: '·', bad: true, expect: a[i - 1], at: i - 1 })
      i -= 1
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      rev.push({ text: b[j - 1], bad: true, expect: a[i - 1], at: i - 1 })
      i -= 1
      j -= 1
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      rev.push({ text: b[j - 1], bad: true, expect: '', at: -1 })
      j -= 1
    } else if (i > 0) {
      rev.push({ text: '·', bad: true, expect: a[i - 1], at: i - 1 })
      i -= 1
    } else {
      rev.push({ text: b[j - 1] || '·', bad: true, expect: '', at: -1 })
      j -= 1
    }
  }
  rev.reverse()
  return rev
}

function readingOf(pinyin: string, hanzi: string, index: number): string {
  return syllableAt(pinyin, hanzi, index).replace(/[.,!?;:，。！？；：、…]+/gu, '')
}

/** Знаки, которые стоит прослушать отдельно: нужный слог или лишний распознанный. */
export function sayFixes(target: string, heard: string, pinyin: string): SayFix[] {
  const out: SayFix[] = []
  for (const piece of alignHeard(target, heard)) {
    if (!piece.bad) continue
    if (!piece.expect) {
      out.push({ kind: 'extra', heard: piece.text, hanzi: piece.text, py: '' })
      continue
    }
    out.push({
      kind: piece.text === '·' ? 'miss' : 'swap',
      heard: piece.text,
      hanzi: piece.expect,
      py: readingOf(pinyin, target, piece.at),
    })
  }
  return out
}

type ResultRow = ArrayLike<{ transcript: string }> & { isFinal?: boolean }
type Recog = {
  lang: string
  maxAlternatives: number
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ResultRow> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type RecogWindow = Window & {
  SpeechRecognition?: new () => Recog
  webkitSpeechRecognition?: new () => Recog
}

export function pronounceSupport(): 'full' | 'webkit' | 'none' {
  if (typeof window === 'undefined') return 'none'
  const host = window as RecogWindow
  if (host.SpeechRecognition) return 'full'
  if (host.webkitSpeechRecognition) return 'webkit'
  return 'none'
}

export function levelsFromBins(bins: ArrayLike<number>, count: number): number[] {
  const out: number[] = []
  const step = Math.max(1, Math.floor(bins.length / Math.max(1, count)))
  for (let i = 0; i < count; i++) {
    let sum = 0
    for (let k = 0; k < step; k++) sum += bins[i * step + k] || 0
    out.push(Math.min(1, sum / step / 255))
  }
  return out
}

type ListenHandlers = {
  onText: (text: string) => void
  onBars: (levels: number[] | null) => void
  onEnd: (result: { heard: string; ok: boolean }) => void
  onError: (message: string) => void
}

type Live = {
  rec: Recog | null
  done: boolean
  text: string
  target: string
  restarts: number
  settle: number
  max: number
  stopMeter: () => void
  onText: ListenHandlers['onText']
  onEnd: ListenHandlers['onEnd']
  onError: ListenHandlers['onError']
}

let live: Live | null = null

function closeRec(rec: Recog | null) {
  if (!rec) return
  rec.onresult = null
  rec.onerror = null
  rec.onend = null
  try { rec.stop() } catch { /* already idle */ }
}

function shutdown(): Live | null {
  const cur = live
  if (!cur || cur.done) return null
  cur.done = true
  window.clearTimeout(cur.settle)
  window.clearTimeout(cur.max)
  cur.stopMeter()
  const rec = cur.rec
  cur.rec = null
  live = null
  closeRec(rec)
  return cur
}

export function listening(): boolean {
  return !!live && !live.done
}

export function stopListen() {
  shutdown()
}

export function finishListen() {
  const cur = shutdown()
  if (!cur) return
  const heard = cur.text.trim()
  cur.onEnd({ heard, ok: !!cur.target && hanPlain(heard) === cur.target })
}

function openMeter(onBars: (levels: number[] | null) => void): () => void {
  let dead = false
  let raf = 0
  let stream: MediaStream | null = null
  let ctx: AudioContext | null = null
  const stop = () => {
    dead = true
    window.cancelAnimationFrame(raf)
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    void ctx?.close()
    ctx = null
  }
  const media = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
  if (!media) {
    onBars(null)
    return stop
  }
  void media({ audio: { echoCancellation: true, noiseSuppression: true } }).then(next => {
    if (dead) {
      next.getTracks().forEach(track => track.stop())
      return
    }
    stream = next
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) {
      onBars(null)
      return
    }
    ctx = new Ctx()
    void ctx.resume()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.65
    source.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      if (dead) return
      analyser.getByteFrequencyData(data)
      onBars(levelsFromBins(data, 12))
      raf = window.requestAnimationFrame(tick)
    }
    tick()
  }).catch(() => { if (!dead) onBars(null) })
  return stop
}

export function listenLive(expectHan: string, handlers: ListenHandlers) {
  const host = window as RecogWindow
  const Ctor = host.SpeechRecognition || host.webkitSpeechRecognition
  stopListen()
  if (!Ctor) {
    handlers.onError('В этом браузере нет распознавания речи.')
    return
  }
  const rec = new Ctor()
  const cur: Live = {
    rec, done: false, text: '', target: hanPlain(expectHan), restarts: 0, settle: 0, max: 0,
    stopMeter: () => {}, onText: handlers.onText, onEnd: handlers.onEnd, onError: handlers.onError,
  }
  live = cur
  cur.stopMeter = openMeter(handlers.onBars)
  rec.lang = 'zh-CN'
  rec.maxAlternatives = 3
  rec.interimResults = true
  rec.continuous = true
  const fail = (message: string) => {
    const saved = shutdown()
    saved?.onError(message)
  }
  const arm = () => {
    window.clearTimeout(cur.settle)
    if (!hanPlain(cur.text)) return
    cur.settle = window.setTimeout(() => {
      if (live !== cur || cur.done || !hanPlain(cur.text)) return
      finishListen()
    }, 700)
  }
  rec.onresult = event => {
    if (live !== cur || cur.done) return
    let finalText = ''
    let interim = ''
    let lastFinal = false
    for (let i = 0; i < event.results.length; i++) {
      const row = event.results[i]
      const alts: string[] = []
      for (let j = 0; j < row.length; j++) alts.push(row[j]?.transcript || '')
      const hit = alts.find(item => hanPlain(item) === cur.target)
      const text = hit || alts[0] || ''
      if (row.isFinal) {
        finalText += text
        lastFinal = true
      } else interim += text
    }
    cur.text = (finalText + interim).trim()
    cur.onText(cur.text)
    if (lastFinal) arm()
    else window.clearTimeout(cur.settle)
  }
  rec.onerror = event => {
    if (live !== cur || cur.done) return
    const code = event.error
    if (code === 'aborted' || code === 'no-speech') return
    if (code === 'not-allowed' || code === 'service-not-allowed') fail('Нет доступа к микрофону. Разрешите его в браузере и нажмите ещё раз.')
    else if (code === 'network') fail('Нет связи с распознаванием. В Chrome это сервис Google.')
    else if (code === 'audio-capture') {
      cur.stopMeter()
      cur.stopMeter = () => {}
      handlers.onBars(null)
      return
    } else fail('Не удалось распознать. Нажмите ещё раз.')
  }
  // Chrome сам закрывает сессию, пока фраза ещё звучит. Пока человек не нажал «Готово», сессию поднимаем снова.
  rec.onend = () => {
    if (live !== cur || cur.done) return
    if (cur.restarts < 3) {
      cur.restarts += 1
      try { rec.start(); return } catch { /* сдаёмся ниже */ }
    }
    if (hanPlain(cur.text)) finishListen()
    else fail('Речь не слышно. Попробуйте ещё раз.')
  }
  cur.max = window.setTimeout(() => {
    if (live !== cur || cur.done) return
    if (hanPlain(cur.text)) finishListen()
    else fail('Речь не слышно. Попробуйте ещё раз.')
  }, 15000)
  try { rec.start() } catch {
    try {
      rec.continuous = false
      rec.start()
    } catch {
      fail('Не удалось включить микрофон.')
    }
  }
}
