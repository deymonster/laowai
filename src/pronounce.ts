export type DiffPiece = { text: string; bad: boolean }

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
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      rev.push({ text: b[j - 1], bad: false })
      i -= 1
      j -= 1
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      rev.push({ text: b[j - 1], bad: true })
      i -= 1
      j -= 1
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      rev.push({ text: b[j - 1], bad: true })
      j -= 1
    } else {
      rev.push({ text: '·', bad: true })
      i -= 1
    }
  }
  rev.reverse()
  return rev
}

type Recog = {
  lang: string
  maxAlternatives: number
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { length: number }> }) => void) | null
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

let active: Recog | null = null

export function stopListen() {
  const rec = active
  active = null
  if (!rec) return
  rec.onresult = null
  rec.onerror = null
  rec.onend = null
  try { rec.stop() } catch { /* already idle */ }
}

export function listenOnce(expectHan: string, onDone: (result: { heard: string; ok: boolean }) => void, onError: (message: string) => void) {
  const host = window as RecogWindow
  const Ctor = host.SpeechRecognition || host.webkitSpeechRecognition
  if (!Ctor) return
  stopListen()
  const rec = new Ctor()
  active = rec
  rec.lang = 'zh-CN'
  rec.maxAlternatives = 3
  rec.interimResults = false
  rec.continuous = false
  let finished = false
  const fail = (message: string) => {
    if (finished || active !== rec) return
    finished = true
    active = null
    onError(message)
  }
  rec.onresult = event => {
    if (finished || active !== rec) return
    finished = true
    active = null
    const row = event.results[0]
    const alts: string[] = []
    if (row) for (let i = 0; i < row.length; i++) alts.push(row[i]?.transcript || '')
    const target = hanPlain(expectHan)
    const hit = alts.find(item => hanPlain(item) === target)
    const heard = hit || alts[0] || ''
    onDone({ heard, ok: !!target && hanPlain(heard) === target })
  }
  rec.onerror = event => {
    const code = event.error
    if (code === 'not-allowed' || code === 'service-not-allowed') fail('Нет доступа к микрофону.')
    else if (code === 'no-speech') fail('Речь не слышно. Попробуйте ещё раз.')
    else if (code === 'network') fail('Нет связи с распознаванием.')
    else if (code === 'aborted') return
    else fail('Не удалось распознать.')
  }
  rec.onend = () => fail('Речь не слышно. Попробуйте ещё раз.')
  try { rec.start() } catch { fail('Не удалось включить микрофон.') }
}
