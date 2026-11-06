import { hanChars } from './han'
import { ui } from './session'

type Writer = {
  animateCharacter: (options?: { onComplete?: () => void }) => void
  animateStroke: (index: number, options?: { onComplete?: () => void }) => void
  getCharacterData: () => Promise<{ strokes: unknown[] }>
  quiz: (options?: {
    onMistake?: () => void
    onCorrectStroke?: () => void
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
    writer = mod.default.create(host, ch, {
      width: 280,
      height: 280,
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
        fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(char)}.json`)
          .then(response => { if (!response.ok) throw new Error('missing'); return response.json() })
          .then(data => onLoad(data))
          .catch(error => onErr(error))
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
    onMistake: () => setMsg('Другая черта или не тот порядок.'),
    onCorrectStroke: () => setMsg(''),
    onComplete: () => setMsg('Знак собран.'),
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
