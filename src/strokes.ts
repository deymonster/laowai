import { hanChars } from './han'
import { ui } from './session'
import { dueLabel, nextDue, selectedWords, type Grade } from './srs'
import { state } from './store'

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
    const grade = document.getElementById('strokeGrade')
    if (grade) grade.innerHTML = ''
    if (ui.strokePlay === 'watch') playAll()
    else startQuiz()
  } catch {
    if (mine === seq) setMsg('Не удалось загрузить порядок черт. Нужен интернет.')
  }
}

function deckWord() {
  const text = ui.writeText.trim()
  const chars = hanChars(text)
  if (!chars.length || ui.writeCi !== chars.length - 1) return undefined
  return selectedWords(state).find(word => word.hanzi === text)
}

function gradeWhen(grade: Grade, id: string): string {
  if (grade === 'again') return 'сейчас'
  const wait = nextDue(state, id, grade)
  if (wait <= 0) return 'позже'
  return dueLabel(wait)
}

export function fillStrokeGrade() {
  const host = document.getElementById('strokeGrade')
  if (!host) return
  const word = deckWord()
  if (!word) { host.innerHTML = ''; return }
  const items: [Grade, string][] = [['again', 'Не помню'], ['hard', 'С трудом'], ['good', 'Помню'], ['easy', 'Легко']]
  host.innerHTML = `<div class="grades">${items.map(([grade, label]) => `<button type="button" class="${grade}" data-act="sgrade" data-g="${grade}">${label}<small>${gradeWhen(grade, word.id)}</small></button>`).join('')}</div>`
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
      setMsg('Знак собран.')
      fillStrokeGrade()
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
