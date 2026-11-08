import { hanChars } from './han'
import { ui } from './session'

type Writer = {
  animateCharacter: (options?: { onComplete?: () => void }) => void
  animateStroke: (index: number, options?: { onComplete?: () => void }) => void
  getCharacterData: () => Promise<{ strokes: unknown[] }>
  quiz: (options?: {
    leniency?: number
    showHintAfterMisses?: number | false
    onMistake?: () => void
    onCorrectStroke?: (stroke?: { strokeNum: number; strokesRemaining: number }) => void
    onComplete?: () => void
  }) => void
}

let writer: Writer | null = null
let seq = 0

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function currentChar(): string {
  return hanChars(ui.writeText).slice(0, 8)[ui.writeCi] || ''
}

function setMsg(text: string) {
  const el = document.getElementById('strokeMsg')
  if (el) el.textContent = text
  ui.strokeMsg = text
}

export async function mountStroke() {
  const host = document.getElementById('writer')
  if (!host) return
  const mine = ++seq
  const ch = currentChar()
  host.replaceChildren()
  writer = null
  if (!ch) { setMsg('Введите иероглиф.'); return }
  setMsg('Загружаем черты…')
  try {
    const mod = await import('hanzi-writer')
    if (mine !== seq) return
    const ink = cssVar('--ink', '#1c1915')
    const guide = cssVar('--muted', '#6d655c')
    const accent = cssVar('--accent', '#9c2f2f')
    const box = Math.floor(Math.min(host.clientWidth || 320, host.clientHeight || host.clientWidth || 320))
    const size = Math.max(220, Math.min(box || 320, 640))
    writer = mod.default.create(host, ch, {
      width: size,
      height: size,
      padding: 14,
      showOutline: true,
      showCharacter: ui.strokePlay === 'watch',
      strokeAnimationSpeed: ui.strokeSlow ? 0.35 : 0.9,
      delayBetweenStrokes: 220,
      strokeColor: ink,
      radicalColor: accent,
      outlineColor: guide,
      drawingColor: accent,
      highlightColor: accent,
      charDataLoader: (char, onLoad, onErr) => {
        const local = `/strokes/${encodeURIComponent(char)}.json`
        const remote = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(char)}.json`
        const pull = (url: string) => fetch(url).then(response => {
          if (!response.ok) throw new Error('missing')
          return response.json()
        })
        pull(local).then(data => onLoad(data)).catch(() => {
          pull(remote).then(data => onLoad(data)).catch(error => onErr(error))
        })
      },
    })
    const data = await writer.getCharacterData()
    if (mine !== seq) return
    ui.strokeTotal = Array.isArray(data.strokes) ? data.strokes.length : 0
    ui.strokeAt = 0
    if (ui.strokePlay === 'watch') playAll()
    else startQuiz()
  } catch {
    if (mine === seq) setMsg('Не удалось загрузить порядок черт. Нужен интернет.')
  }
}

function startQuiz() {
  if (!writer) return
  setMsg('Обведите черты по порядку. Неверная черта не засчитывается.')
  writer.quiz({
    leniency: 1,
    showHintAfterMisses: 2,
    onMistake: () => setMsg('Другая черта или не тот порядок.'),
    onCorrectStroke: stroke => {
      const done = (stroke?.strokeNum ?? 0) + 1
      const total = ui.strokeTotal || done + (stroke?.strokesRemaining ?? 0)
      setMsg(`Черта ${done} из ${total}`)
    },
    onComplete: () => {
      const chars = hanChars(ui.writeText).slice(0, 8)
      const last = !chars.length || ui.writeCi >= chars.length - 1
      setMsg(last ? 'Знак собран.' : 'Знак собран. Стрелка справа откроет следующий.')
    },
  })
}

function playAll() {
  if (!writer) return
  ui.strokeAt = 0
  setMsg(ui.strokeTotal ? `Черт: 0 / ${ui.strokeTotal}` : '')
  writer.animateCharacter({ onComplete: () => setMsg(ui.strokeTotal ? `Черт: ${ui.strokeTotal} / ${ui.strokeTotal}` : '') })
}

export function replayStroke() {
  if (!writer) { void mountStroke(); return }
  if (ui.strokePlay === 'watch') playAll()
  else startQuiz()
}

export function stepStroke() {
  if (!writer || !ui.strokeTotal) { void mountStroke(); return }
  if (ui.strokeAt >= ui.strokeTotal) ui.strokeAt = 0
  const index = ui.strokeAt
  ui.strokeAt += 1
  setMsg(`Черта ${index + 1} из ${ui.strokeTotal}`)
  writer.animateStroke(index)
}
