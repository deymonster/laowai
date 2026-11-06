import './style.css'
import { unlock } from './achieve'
import { lookupWord, type DictHit } from './dict'
import { cleanGloss, esc, exampleFits, hanChars, studyExample, uid } from './han'
import { analyze, compose, judge, prettifyPinyin, syllableAt, type Reading } from './pinyin'
import { blankEditor, ui, type Editor, type QuizKind } from './session'
import { setSpeakNotice, speak, warm } from './speech'
import { makeQuiz } from './quiz'
import { mountStroke, replayStroke, stepStroke } from './strokes'
import { applyGrade, applyResult, buildQueue, findWord, selectedWords, shuffle } from './srs'
import { adoptRaw, load, resetState, save, state } from './store'
import type { Word } from './types'
import { gramListHtml, dictHitHtml, editorFromWord, listResults, readingExtras, renderApp, writeGlossInner } from './view'
import { listenOnce, stopListen } from './pronounce'

let toastTimer = 0
let wordToken = 0
let exampleToken = 0
let lookupTimer = 0
let lookupSeq = 0
let glossSeq = 0
const glossRu = new Map<string, string>()

function paintWriteGloss() {
  const el = document.getElementById('wgloss')
  if (el) el.innerHTML = writeGlossInner()
}

function readingAt(parts: Reading[], index: number): { py: string; alts: string[] } {
  let seen = 0
  for (const part of parts) {
    if (!part.han) continue
    const size = [...part.ch].filter(ch => /\p{Script=Han}/u.test(ch)).length || 1
    if (index < seen + size) {
      const syllables = part.value.trim().split(/\s+/).filter(Boolean)
      const py = size === 1 ? part.value : syllables.length === size ? syllables[index - seen] || '' : ''
      return { py, alts: size === 1 ? part.options.filter(item => item && item !== py) : [] }
    }
    seen += size
  }
  return { py: '', alts: [] }
}

async function refreshWriteGloss() {
  const seq = ++glossSeq
  const chars = hanChars(ui.writeText).slice(0, 8)
  const index = chars.length ? Math.min(Math.max(ui.writeCi, 0), chars.length - 1) : 0
  const ch = chars[index] || ''
  const text = chars.join('')
  const known = text ? state.words.find(word => word.hanzi === text) : undefined
  const alone = ch ? state.words.find(word => word.hanzi === ch) : undefined
  const gloss = ui.gloss
  gloss.char = ch
  gloss.py = known ? syllableAt(known.pinyin, known.hanzi, index) : ''
  if (!gloss.py && alone && text === ch) gloss.py = syllableAt(alone.pinyin, alone.hanzi, 0) || alone.pinyin.trim()
  gloss.alts = []
  gloss.ru = alone?.ru || ''
  gloss.note = gloss.ru ? '' : ch ? 'Ищем перевод…' : ''
  gloss.wordHan = known && known.hanzi !== ch ? known.hanzi : ''
  gloss.wordPy = gloss.wordHan ? known?.pinyin || '' : ''
  gloss.wordRu = gloss.wordHan ? known?.ru || '' : ''
  paintWriteGloss()
  if (!ch) return
  if (!gloss.py) {
    const result = await analyze(text)
    if (seq !== glossSeq) return
    const reading = readingAt(result.parts, index)
    gloss.py = reading.py
    gloss.alts = reading.alts
    paintWriteGloss()
  }
  if (gloss.ru) return
  if (glossRu.has(ch)) {
    const cached = glossRu.get(ch) || ''
    gloss.ru = cached
    gloss.note = cached ? '' : 'Перевода в словаре нет.'
    paintWriteGloss()
    return
  }
  try {
    const hits = await lookupWord(ch)
    if (seq !== glossSeq) return
    const ru = hits.find(item => item.hanzi === ch)?.ru || ''
    glossRu.set(ch, ru)
    gloss.ru = ru
    gloss.note = ru ? '' : 'Перевода в словаре нет.'
  } catch {
    if (seq !== glossSeq) return
    gloss.note = 'Словарь не ответил.'
  }
  paintWriteGloss()
}

setSpeakNotice(message => toast(message))

function toast(message: string) {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    el.setAttribute('role', 'status')
    document.body.appendChild(el)
  }
  el.textContent = message
  el.hidden = false
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { if (el) el.hidden = true }, 2800)
}

function applyTheme() {
  const theme = state.settings.theme
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
}

function draw() {
  const app = document.getElementById('app')
  if (!app) return
  app.innerHTML = renderApp()
  applyTheme()
  bindLive()
  const currentList = document.querySelector('.topics[aria-label="Списки"] .chip[aria-pressed="true"]')
  if (currentList instanceof HTMLElement) currentList.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  if (ui.view === 'write' && ui.writeMode === 'stroke' && !ui.type) {
    void mountStroke()
    void refreshWriteGloss()
  }
  const scrollId = ui.scrollTopic
  ui.scrollTopic = null
  const head = scrollId ? document.getElementById(`topic-${scrollId}`) : null
  if (head) head.scrollIntoView({ block: 'start' })
  armClock()
  warmVisible()
}

function warmVisible() {
  if (state.settings.voice === 'system') return
  if (ui.view === 'study' && ui.study?.ids.length) {
    const word = findWord(state, ui.study.ids[0])
    if (word) warm(word.hanzi, word.pinyin)
  }
  const quiz = ui.quiz
  if (ui.view === 'quiz' && quiz && quiz.i < quiz.items.length) {
    const word = findWord(state, quiz.items[quiz.i].id)
    if (word) {
      if (quiz.kind === 'sent' || quiz.kind === 'say') warm(word.example, word.examplePy)
      else if (quiz.kind !== 'gram') warm(word.hanzi, word.pinyin)
    }
  }
  const typing = ui.type
  if (ui.view === 'write' && ui.writeMode === 'type' && typing && typing.i < typing.ids.length) {
    const word = findWord(state, typing.ids[typing.i])
    if (word) warm(word.hanzi, word.pinyin)
  }
  if (ui.view === 'edit' && ui.editor?.hanzi) warm(ui.editor.hanzi, ui.editor.pinyin)
}

let clockTimer = 0

function persist() {
  const fresh = unlock(state)
  save()
  if (fresh.length) toast(fresh.map(title => `Достижение: ${title}`).join(' '))
}

function armClock() {
  window.clearInterval(clockTimer)
  clockTimer = 0
  const quiz = ui.quiz
  if (!quiz || quiz.kind !== 'speed' || quiz.i >= quiz.items.length) return
  clockTimer = window.setInterval(() => {
    const current = ui.quiz
    if (!current || current.kind !== 'speed' || current.i >= current.items.length) {
      window.clearInterval(clockTimer)
      return
    }
    const left = current.until - Date.now()
    if (left <= 0) {
      current.i = current.items.length
      if (current.ok > state.rec) state.rec = current.ok
      persist()
      draw()
      return
    }
    const el = document.getElementById('qclock')
    if (el) el.textContent = `${Math.ceil(left / 1000)} с`
  }, 200)
}

function field(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  return el ? el.value : ''
}

function readEditor() {
  const editor = ui.editor
  if (!editor || ui.view !== 'edit') return
  if (document.getElementById('f-han')) {
    editor.hanzi = field('f-han')
    editor.pinyin = field('f-py')
    editor.ru = field('f-ru')
    editor.pos = field('f-pos')
    editor.topic = field('f-topic') || editor.topic
    const level = Number(field('f-hsk'))
    if ([1, 2, 3, 4, 5, 6].includes(level)) editor.level = level
    editor.note = field('f-note')
    editor.example = field('f-ex')
    editor.examplePy = field('f-expy')
    editor.exampleRu = field('f-exru')
    editor.surname = (document.getElementById('f-sur') as HTMLInputElement | null)?.checked || false
    editor.query = field('f-q')
  }
}

function mismatch(hanzi: string, pinyin: string): string {
  const hans = hanChars(hanzi).length
  const count = pinyin.trim() ? pinyin.trim().split(/\s+/).length : 0
  if (!hans || !count || hans === count) return ''
  return `Иероглифов ${hans}, слогов в пиньине ${count}. Проверьте чтение.`
}

async function refreshReading(scope: 'word' | 'ex') {
  const editor = ui.editor
  if (!editor) return
  const token = scope === 'word' ? ++wordToken : ++exampleToken
  const text = scope === 'word' ? field('f-han') : field('f-ex')
  if (scope === 'word') editor.hanzi = text
  else editor.example = text
  const box = document.getElementById(scope === 'word' ? 'pybox' : 'exbox')
  if (box) box.innerHTML = '<p class="hint">Подбираем чтение…</p>'
  const result = await analyze(text, scope === 'word' && editor.surname)
  const current = scope === 'word' ? wordToken : exampleToken
  if (token !== current || ui.editor !== editor) return
  if (scope === 'word') {
    editor.parts = result.parts
    if (editor.auto) {
      editor.pinyin = compose(result.parts, editor.picks)
      const input = document.getElementById('f-py') as HTMLInputElement | null
      if (input) input.value = editor.pinyin
    }
    if (box) box.innerHTML = readingExtras(editor.parts, editor.picks, 'word')
    const warn = document.getElementById('editwarn')
    if (warn) warn.textContent = mismatch(editor.hanzi, field('f-py') || editor.pinyin)
  } else {
    editor.exampleParts = result.parts
    if (editor.exampleAuto) {
      editor.examplePy = compose(result.parts, editor.examplePicks)
      const input = document.getElementById('f-expy') as HTMLInputElement | null
      if (input) input.value = editor.examplePy
    }
    if (box) box.innerHTML = readingExtras(editor.exampleParts, editor.examplePicks, 'ex')
  }
}

function setVal(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (el) el.value = value
}

function showHits(editor: Editor) {
  const box = document.getElementById('hits')
  const msg = document.getElementById('lookupmsg')
  if (box) box.innerHTML = dictHitHtml(editor.hits)
  if (msg) msg.textContent = editor.lookupMsg
}

function applyHit(hit: DictHit, overwrite: boolean) {
  readEditor()
  const editor = ui.editor
  if (!editor) return
  editor.hanzi = hit.hanzi
  editor.auto = true
  editor.picks = {}
  const previous = savedGloss(editor)
  const keepRu = !overwrite && !!editor.ru.trim() && editor.ru.trim() !== previous
  editor.lastHit = `${hit.hanzi}\n${hit.ru}`
  if (!keepRu) editor.ru = cleanGloss(hit.ru)
  const phrase = hit.example && studyExample(hit.hanzi, hit.example) ? hit.example : ''
  const stale = !!editor.example.trim() && !exampleFits(hit.hanzi, editor.example)
  if (phrase && (overwrite || !editor.example.trim() || stale)) {
    editor.example = phrase
    editor.exampleRu = cleanGloss(hit.exampleRu)
    editor.examplePy = ''
    editor.exampleAuto = true
    editor.examplePicks = {}
    editor.exampleParts = []
  } else if (stale) {
    editor.example = ''
    editor.exampleRu = ''
    editor.examplePy = ''
    editor.exampleAuto = true
    editor.examplePicks = {}
    editor.exampleParts = []
  }
  const known = state.words.filter(word => word.hanzi === hit.hanzi && /^hsk[1-6]$/.test(word.topic))
  if (known.length) editor.level = Math.min(...known.map(word => word.level))
  setVal('f-han', editor.hanzi)
  setVal('f-ru', editor.ru)
  setVal('f-ex', editor.example)
  setVal('f-expy', editor.examplePy)
  setVal('f-exru', editor.exampleRu)
  const levelPick = document.getElementById('f-hsk') as HTMLSelectElement | null
  if (levelPick) levelPick.value = String(editor.level)
  void refreshReading('word')
  if (editor.example) void refreshReading('ex')
  else {
    const box = document.getElementById('exbox')
    if (box) box.innerHTML = ''
  }
}

function savedGloss(editor: Editor): string {
  const cut = editor.lastHit.indexOf('\n')
  return cut < 0 ? '' : editor.lastHit.slice(cut + 1)
}

function maybeApply(query: string, items: DictHit[]): boolean {
  const editor = ui.editor
  if (!editor || !items.length) return false
  const compact = query.replace(/\s+/g, '')
  const same = /\p{Script=Han}/u.test(compact) ? items.filter(item => item.hanzi === compact) : []
  if (items.length !== 1 && !same.length) return false
  const currentRu = field('f-ru').trim()
  const ruLocked = !!currentRu && currentRu !== savedGloss(editor)
  const hanEmpty = !hanChars(field('f-han')).length
  if (ruLocked && !hanEmpty) return false
  const hit = same[0] || items[0]
  if (editor.lastHit === `${hit.hanzi}\n${hit.ru}` && field('f-han').replace(/\s+/g, '') === hit.hanzi && currentRu === hit.ru) return true
  applyHit(hit, false)
  return true
}

async function runLookup(q: string) {
  const editor = ui.editor
  if (!editor || ui.view !== 'edit') return
  const query = q.trim()
  if (!query) {
    editor.hits = []
    editor.lookupMsg = ''
    showHits(editor)
    return
  }
  const seq = ++lookupSeq
  editor.lookupMsg = 'Ищем в БКРС…'
  showHits(editor)
  try {
    const items = await lookupWord(query)
    if (seq !== lookupSeq || ui.editor !== editor) return
    editor.hits = items
    editor.lookupMsg = items.length > 1 ? 'Несколько значений. Выберите подходящее.' : items.length ? 'Нашли в БКРС.' : 'В БКРС ничего не нашлось. Поля можно заполнить вручную.'
    showHits(editor)
    const applied = maybeApply(query, items)
    if (applied) editor.lookupMsg = items.length > 1 ? 'Подставлено первое значение. Можно выбрать другое.' : 'Подставлено из БКРС.'
    showHits(editor)
  } catch (error) {
    if (seq !== lookupSeq || ui.editor !== editor) return
    editor.hits = []
    editor.lookupMsg = error instanceof Error ? error.message : 'Словарь БКРС сейчас не ответил.'
    showHits(editor)
  }
}

function scheduleLookup(q: string) {
  window.clearTimeout(lookupTimer)
  lookupTimer = window.setTimeout(() => { void runLookup(q) }, 350)
}

function bindLive() {
  const search = document.getElementById('q') as HTMLInputElement | null
  search?.addEventListener('input', () => {
    ui.q = search.value
    ui.listExtra = 0
    const box = document.getElementById('results')
    if (box) box.innerHTML = listResults()
  })
  const gfind = document.getElementById('gfind') as HTMLInputElement | null
  gfind?.addEventListener('input', () => {
    ui.gramQ = gfind.value
    const box = document.getElementById('grules')
    if (box) box.innerHTML = gramListHtml()
  })
  const han = document.getElementById('f-han') as HTMLInputElement | null
  const example = document.getElementById('f-ex') as HTMLInputElement | null
  let composing = false
  if (han) {
    const onHan = () => {
      if (!ui.editor) return
      ui.editor.picks = {}
      ui.editor.auto = true
      if (ui.editor.example.trim() && !exampleFits(han.value, ui.editor.example)) {
        ui.editor.example = ''
        ui.editor.exampleRu = ''
        ui.editor.examplePy = ''
        ui.editor.exampleParts = []
        ui.editor.examplePicks = {}
        const ex = document.getElementById('f-ex') as HTMLInputElement | null
        const exPy = document.getElementById('f-expy') as HTMLInputElement | null
        const exRu = document.getElementById('f-exru') as HTMLInputElement | null
        if (ex) ex.value = ''
        if (exPy) exPy.value = ''
        if (exRu) exRu.value = ''
        const box = document.getElementById('exbox')
        if (box) box.innerHTML = ''
      }
      void refreshReading('word')
      if (hanChars(han.value).length) scheduleLookup(han.value)
    }
    han.addEventListener('compositionstart', () => { composing = true })
    han.addEventListener('compositionend', () => { composing = false; onHan() })
    han.addEventListener('input', () => { if (!composing) onHan() })
  }
  const query = document.getElementById('f-q') as HTMLInputElement | null
  if (query) {
    let composingQuery = false
    const queue = () => { if (ui.editor) ui.editor.query = query.value; scheduleLookup(query.value) }
    query.addEventListener('compositionstart', () => { composingQuery = true })
    query.addEventListener('compositionend', () => { composingQuery = false; queue() })
    query.addEventListener('input', () => { if (!composingQuery) queue() })
    query.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      window.clearTimeout(lookupTimer)
      if (ui.editor) ui.editor.query = query.value
      void runLookup(query.value)
    })
  }
  example?.addEventListener('compositionstart', () => { composing = true })
  example?.addEventListener('compositionend', () => { composing = false; if (ui.editor) { ui.editor.examplePicks = {}; ui.editor.exampleAuto = true }; void refreshReading('ex') })
  example?.addEventListener('input', () => { if (!composing && ui.editor) { ui.editor.examplePicks = {}; ui.editor.exampleAuto = true; void refreshReading('ex') } })
  document.getElementById('f-py')?.addEventListener('input', () => {
    if (!ui.editor) return
    ui.editor.auto = false
    ui.editor.pinyin = field('f-py')
    const warn = document.getElementById('editwarn')
    if (warn) warn.textContent = mismatch(field('f-han'), ui.editor.pinyin)
  })
  document.getElementById('f-expy')?.addEventListener('input', () => {
    if (!ui.editor) return
    ui.editor.exampleAuto = false
    ui.editor.examplePy = field('f-expy')
  })
  document.getElementById('f-sur')?.addEventListener('change', () => {
    if (!ui.editor) return
    ui.editor.surname = (document.getElementById('f-sur') as HTMLInputElement).checked
    ui.editor.picks = {}
    ui.editor.auto = true
    void refreshReading('word')
  })
  const write = document.getElementById('wtxt') as HTMLInputElement | null
  if (write) {
    let writing = false
    const update = () => {
      ui.writeText = write.value
      ui.writeCi = 0
      const box = document.getElementById('wchars')
      if (box) {
        const chars = hanChars(ui.writeText).slice(0, 8)
        box.innerHTML = chars.map((ch, index) => `<button type="button" class="chip hz${index === 0 ? ' on' : ''}" data-act="wchar" data-i="${index}" lang="zh-Hans">${esc(ch)}</button>`).join('')
      }
      void mountStroke()
      void refreshWriteGloss()
    }
    write.addEventListener('compositionstart', () => { writing = true })
    write.addEventListener('compositionend', () => { writing = false; update() })
    write.addEventListener('input', () => { if (!writing) update() })
  }
  document.getElementById('imp')?.addEventListener('change', event => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) void importFile(file)
  })
  document.getElementById('ans')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); void act('tcheck', document.body) }
  })
}

function openEditor(editor: Editor) {
  ui.editor = editor
  ui.view = 'edit'
  ui.study = null
  ui.quiz = null
  ui.type = null
  draw()
  if (editor.hanzi) void refreshReading('word')
  if (editor.example) void refreshReading('ex')
}

function speakQuizItem() {
  const quiz = ui.quiz
  const item = quiz?.items[quiz.i]
  if (!quiz || !item || quiz.i >= quiz.items.length) return
  const word = findWord(state, item.id)
  if (!word) return
  if (quiz.kind === 'aud') void speak(word.hanzi, word.pinyin)
  if (quiz.kind === 'sent') void speak(word.example, word.examplePy)
}

function startQuiz(kind: QuizKind) {
  const quiz = makeQuiz(kind)
  if (!quiz) return
  ui.quiz = quiz
  ui.view = 'quiz'
  draw()
  speakQuizItem()
}

async function saveEditor() {
  readEditor()
  const editor = ui.editor
  if (!editor) return
  const hanzi = editor.hanzi.trim()
  if (!hanChars(hanzi).length) { editor.error = 'Введите хотя бы один иероглиф.'; draw(); return }
  const ru = editor.ru.trim()
  if (!ru) { editor.error = 'Нужен перевод: выберите его из словаря или впишите сами.'; draw(); return }
  const topic = editor.topic || ui.folder || 'my'
  let pinyin = editor.pinyin.trim()
  if (!pinyin) {
    const result = await analyze(hanzi, editor.surname)
    pinyin = compose(result.parts, editor.picks)
  }
  pinyin = prettifyPinyin(pinyin)
  if (!pinyin) { editor.error = 'Не удалось получить пиньинь. Впишите чтение вручную.'; draw(); return }
  const rawExample = editor.example.trim()
  const example = exampleFits(hanzi, rawExample) ? rawExample : ''
  let examplePy = example ? editor.examplePy.trim() : ''
  if (example && !examplePy) examplePy = (await analyze(example, false)).text
  if (examplePy) examplePy = prettifyPinyin(examplePy)
  const word: Word = {
    id: editor.id || uid('c'),
    topic, hanzi, pinyin, ru, pos: editor.pos, note: editor.note.trim(),
    example, examplePy, exampleRu: example ? editor.exampleRu.trim() : '',
    uses: (editor.id ? (findWord(state, editor.id)?.uses || []) : []).filter(item => exampleFits(hanzi, item.hanzi)),
    level: editor.level,
    custom: editor.id ? (findWord(state, editor.id)?.custom ?? true) : true,
  }
  const index = state.words.findIndex(item => item.id === word.id)
  if (index >= 0) state.words[index] = word
  else state.words.unshift(word)
  if (topic === 'my' && !state.my.includes(word.id)) state.my.push(word.id)
  if (!state.lv.includes(topic)) state.lv.push(topic)
  save()
  ui.editor = null
  ui.view = 'list'
  ui.folder = topic
  ui.openId = word.id
  ui.q = ''
  toast('Слово сохранено')
  draw()
}

async function importFile(file: File) {
  try {
    const data = JSON.parse(await file.text()) as { v?: number; words?: Word[]; topics?: { id: string; name: string; builtin?: boolean }[] }
    if (data && data.v === 1 && Array.isArray(data.words) && data.words.every(word => word && word.id && word.hanzi)) {
      adoptRaw(data)
      toast('Файл загружен')
      draw()
      return
    }
    const rows = Array.isArray(data) ? data : data.words
    if (!Array.isArray(rows)) throw new Error('format')
    let added = 0
    for (const row of rows) {
      const hanzi = String(row.hanzi || row.h || '').trim()
      const ru = String(row.ru || row.translation || '').trim()
      if (!hanzi || !ru) continue
      let topic = 'my'
      const name = String(row.topic || row.theme || '').trim()
      if (name && name !== 'my') {
        const found = state.topics.find(topicItem => topicItem.name.toLowerCase() === name.toLowerCase() || topicItem.id === name)
        if (found) topic = found.id
        else {
          topic = uid('t')
          state.topics.push({ id: topic, name, builtin: false })
        }
      }
      const given = String(row.pinyin || row.py || '').trim()
      const pinyin = prettifyPinyin(given || (await analyze(hanzi, false)).text)
      state.words.unshift({
        id: uid('c'), topic, hanzi, pinyin, ru, pos: String(row.pos || ''), note: String(row.note || ''),
        example: String(row.example || ''), examplePy: String(row.examplePy || ''), exampleRu: String(row.exampleRu || ''), uses: [], level: [1, 2, 3, 4, 5, 6].includes(Number(row.level)) ? Number(row.level) : 1, custom: true,
      })
      added++
    }
    save()
    toast(added ? `Добавлено слов: ${added}` : 'В файле нет слов')
    draw()
  } catch {
    toast('Не удалось прочитать файл')
  }
}

function exportFile() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'svoi-slova.json'
  link.click()
  URL.revokeObjectURL(link.href)
}

async function act(name: string, el: HTMLElement) {
  if (ui.view === 'edit' && !['pypick', 'speak', 'pickword'].includes(name)) readEditor()
  switch (name) {
    case 'home': ui.view = 'study'; ui.study = null; ui.quiz = null; ui.type = null; break
    case 'settings': ui.view = 'set'; break
    case 'tab': {
      ui.view = (el.dataset.v as typeof ui.view) || 'study'
      ui.study = null; ui.quiz = null; ui.type = null
      break
    }
    case 'lv': {
      const id = el.dataset.n || ''
      if (!id || !state.topics.some(topic => topic.id === id)) return
      if (state.lv.includes(id)) {
        if (state.lv.length === 1) toast('В списке нужна хотя бы одна подборка')
        else state.lv = state.lv.filter(item => item !== id)
      } else {
        state.lv.push(id)
        ui.focusTopic = id
      }
      if (state.lv.includes(id)) ui.scrollTopic = id
      const opened = ui.view === 'list' && !ui.showFolders && !ui.folder
      if (!opened) {
        ui.q = ''
        ui.openId = null
        ui.status = 'all'
      }
      ui.showFolders = false
      ui.folder = null
      ui.listExtra = 0
      ui.view = 'list'
      ui.study = null
      ui.quiz = null
      ui.type = null
      save()
      break
    }
    case 'hsk': {
      const level = Number(el.dataset.n)
      if (![1, 2, 3, 4, 5, 6].includes(level)) return
      if (state.hsk.includes(level)) { if (state.hsk.length > 1) state.hsk = state.hsk.filter(item => item !== level) }
      else state.hsk.push(level)
      state.hsk.sort((a, b) => a - b)
      save(); break
    }
    case 'dir': state.settings.dir = el.dataset.v === 'r2h' ? 'r2h' : 'h2r'; save(); break
    case 'start':
    case 'more': {
      const queue = buildQueue(state, name === 'more' ? 10 : undefined)
      ui.study = { ids: queue.ids, kind: queue.kind, total: queue.ids.length, n: 0, failed: [], show: false }
      ui.view = 'study'; break
    }
    case 'show': if (ui.study) ui.study.show = true; break
    case 'grade': {
      const sess = ui.study
      if (!sess?.ids.length) return
      const id = sess.ids.shift() || ''
      const grade = el.dataset.g === 'again' || el.dataset.g === 'hard' || el.dataset.g === 'easy' ? el.dataset.g : el.dataset.g === 'good' ? 'good' : ''
      if (!grade) return
      applyGrade(state, id, grade)
      if (grade === 'again') {
        if (!sess.failed.includes(id)) sess.ids.push(id)
        sess.failed.push(id)
      } else state.cor += 1
      sess.n += 1
      sess.show = false
      persist(); break
    }
    case 'stop': ui.study = null; break
    case 'speak': {
      const buttonText = el.dataset.t || ''
      const live = ui.view === 'edit' ? field('f-han').trim() : ''
      const wordButton = ui.view === 'edit' && (!buttonText || buttonText === live || buttonText === (ui.editor?.hanzi || ''))
      const text = wordButton ? (live || buttonText) : buttonText
      const py = wordButton ? field('f-py') : (el.dataset.py || '')
      void speak(text, py)
      return
    }
    case 'pickword': {
      const editor = ui.editor
      const hit = editor?.hits[Number(el.dataset.i)]
      if (!editor || !hit) return
      applyHit(hit, true)
      editor.lookupMsg = 'Подставлено из БКРС.'
      showHits(editor)
      return
    }
    case 'star': {
      const id = el.dataset.id || ''
      if (state.my.includes(id)) state.my = state.my.filter(item => item !== id)
      else state.my.push(id)
      save(); break
    }
    case 'open': ui.openId = ui.openId === el.dataset.id ? null : el.dataset.id || null; break
    case 'status': ui.status = (el.dataset.v as typeof ui.status) || 'all'; ui.listExtra = 0; break
    case 'listmore': ui.listExtra += 800; break
    case 'add': {
      const selected = state.lv.filter(id => state.topics.some(item => item.id === id))
      const topic = ui.folder && state.topics.some(item => item.id === ui.folder) ? ui.folder : selected.length === 1 ? selected[0] : selected[selected.length - 1] || 'my'
      const editor = blankEditor(topic)
      if (state.hsk.length === 1) editor.level = state.hsk[0]
      openEditor(editor)
      return
    }
    case 'folder': ui.showFolders = false; ui.folder = el.dataset.n || null; ui.q = ''; ui.openId = null; ui.status = 'all'; ui.listExtra = 0; break
    case 'folders': ui.showFolders = true; ui.folder = null; ui.q = ''; ui.openId = null; break
    case 'edit': {
      const word = findWord(state, el.dataset.id || '')
      if (word) openEditor(editorFromWord(word))
      return
    }
    case 'del': {
      const id = el.dataset.id || ''
      const word = findWord(state, id)
      if (!word?.custom) return
      state.words = state.words.filter(item => item.id !== id)
      state.my = state.my.filter(item => item !== id)
      delete state.prog[id]
      save(); break
    }
    case 'back': ui.editor = null; ui.view = 'list'; break
    case 'save': await saveEditor(); return
    case 'pyreset': {
      const editor = ui.editor
      if (!editor) return
      editor.auto = true
      editor.picks = {}
      editor.pinyin = compose(editor.parts, {})
      const input = document.getElementById('f-py') as HTMLInputElement | null
      if (input) input.value = editor.pinyin
      const box = document.getElementById('pybox')
      if (box) box.innerHTML = readingExtras(editor.parts, editor.picks, 'word')
      return
    }
    case 'pypick': {
      const editor = ui.editor
      if (!editor) return
      const index = Number(el.dataset.i)
      const value = el.dataset.v || ''
      const scope = el.dataset.which === 'ex' ? 'ex' : 'word'
      if (scope === 'ex') {
        editor.examplePicks[index] = value
        editor.exampleAuto = false
        editor.examplePy = compose(editor.exampleParts, editor.examplePicks)
        const input = document.getElementById('f-expy') as HTMLInputElement | null
        if (input) input.value = editor.examplePy
        const box = document.getElementById('exbox')
        if (box) box.innerHTML = readingExtras(editor.exampleParts, editor.examplePicks, 'ex')
      } else {
        editor.picks[index] = value
        editor.auto = false
        editor.pinyin = compose(editor.parts, editor.picks)
        const input = document.getElementById('f-py') as HTMLInputElement | null
        if (input) input.value = editor.pinyin
        const box = document.getElementById('pybox')
        if (box) box.innerHTML = readingExtras(editor.parts, editor.picks, 'word')
        const warn = document.getElementById('editwarn')
        if (warn) warn.textContent = mismatch(editor.hanzi, editor.pinyin)
      }
      return
    }
    case 'qkind': ui.quizKind = (el.dataset.v as QuizKind) || 'h2r'; break
    case 'qstart':
    case 'qagain': startQuiz(ui.quizKind); return
    case 'qpick': {
      const quiz = ui.quiz
      if (!quiz || quiz.kind === 'say') return
      const item = quiz.items[quiz.i]
      if (!item || item.pick != null) return
      item.pick = Number(el.dataset.k)
      const ok = !!item.opts[item.pick]?.ok
      if (ok) {
        quiz.ok += 1
        state.cor += 1
      } else quiz.bad.push(item.id)
      if (findWord(state, item.id)) applyResult(state, item.id, ok)
      if (quiz.kind === 'speed') {
        if (!ok) quiz.until -= 3000
        if (quiz.until <= Date.now() || quiz.i + 1 >= quiz.items.length) {
          quiz.i = quiz.items.length
          if (quiz.ok > state.rec) state.rec = quiz.ok
        } else quiz.i += 1
        persist()
        toast(ok ? 'Верно' : 'Мимо, −3 с')
        break
      }
      persist(); break
    }
    case 'qnext': {
      stopListen()
      if (ui.quiz) ui.quiz.i += 1
      draw()
      speakQuizItem()
      return
    }
    case 'qstop': stopListen(); ui.quiz = null; break
    case 'sayrec': {
      const quiz = ui.quiz
      const item = quiz?.items[quiz.i]
      const word = item ? findWord(state, item.id) : undefined
      if (!quiz || quiz.kind !== 'say' || !item || !word || item.mark) return
      listenOnce(word.example, result => {
        if (ui.quiz !== quiz || quiz.items[quiz.i] !== item) return
        item.heard = result.heard
        item.mark = result.ok ? 'ok' : 'off'
        item.pick = result.ok ? 1 : 0
        if (result.ok) quiz.ok += 1
        else quiz.bad.push(item.id)
        draw()
      }, message => toast(message))
      return
    }
    case 'saymark': {
      const quiz = ui.quiz
      const item = quiz?.items[quiz.i]
      const word = item ? findWord(state, item.id) : undefined
      if (!quiz || quiz.kind !== 'say' || !item || !word || item.mark) return
      if (el.dataset.v === 'miss') { void speak(word.example, word.examplePy); return }
      item.mark = 'skip'
      item.pick = 0
      draw()
      return
    }
    case 'sgrade': {
      const grade = el.dataset.g
      const text = ui.writeText.trim()
      const chars = hanChars(text)
      const word = chars.length && ui.writeCi === chars.length - 1 ? selectedWords(state).find(item => item.hanzi === text) : undefined
      if (!word || (grade !== 'again' && grade !== 'hard' && grade !== 'good' && grade !== 'easy')) return
      applyGrade(state, word.id, grade)
      save()
      const host = document.getElementById('strokeGrade')
      if (host) host.innerHTML = '<p class="muted">Оценка записана.</p>'
      toast('Оценка записана')
      return
    }
    case 'wmode': ui.writeMode = el.dataset.v === 'type' ? 'type' : 'stroke'; ui.type = null; break
    case 'wchar': ui.writeCi = Number(el.dataset.i) || 0; break
    case 'wpick': ui.writeText = el.dataset.h || ''; ui.writeCi = 0; break
    case 'smode': ui.strokePlay = el.dataset.v === 'quiz' ? 'quiz' : 'watch'; break
    case 'wplay':
    case 'wreset': replayStroke(); return
    case 'wstep': stepStroke(); return
    case 'wslow': ui.strokeSlow = !ui.strokeSlow; break
    case 'tmode': ui.typeMode = el.dataset.v === 'hz' ? 'hz' : 'py'; break
    case 'tstart': {
      const ids = shuffle(selectedWords(state)).slice(0, 10).map(word => word.id)
      ui.type = { mode: ui.typeMode, ids, i: 0, ok: 0, bad: [], res: null }
      ui.writeMode = 'type'; break
    }
    case 'tcheck':
    case 'tskip': {
      const sess = ui.type
      if (!sess || sess.res) return
      const word = findWord(state, sess.ids[sess.i] || '')
      if (!word) return
      const value = name === 'tskip' ? '' : field('ans')
      const result = name === 'tskip' ? 'wrong' : sess.mode === 'hz'
        ? (value.replace(/\s+/g, '') === word.hanzi.replace(/[（）()\s]/g, '') ? 'ok' : 'wrong')
        : judge(value, word.pinyin, state.settings.strict)
      sess.res = { r: result, val: value }
      const ok = result === 'ok' || result === 'ok-nt'
      if (ok) {
        sess.ok += 1
        state.cor += 1
      } else sess.bad.push(word.id)
      applyResult(state, word.id, ok)
      persist(); break
    }
    case 'tnext': {
      const sess = ui.type
      if (!sess) return
      sess.i += 1
      sess.res = null
      break
    }
    case 'tstop': ui.type = null; break
    case 'newtopic': {
      const name = field('newtopic').trim()
      if (!name) return
      if (state.topics.some(topic => topic.name.toLowerCase() === name.toLowerCase())) { toast('Такая тема уже есть'); return }
      const id = uid('t')
      state.topics.push({ id, name, builtin: false })
      if (!state.lv.includes(id)) state.lv.push(id)
      ui.showFolders = false
      ui.folder = id
      ui.focusTopic = id
      ui.dropTopic = null
      ui.q = ''
      ui.openId = null
      ui.view = 'list'
      save(); break
    }
    case 'rentopic': {
      const id = el.dataset.n || ''
      const topic = state.topics.find(item => item.id === id)
      const name = field('renametopic').trim()
      if (!topic || topic.builtin || !name) return
      if (state.topics.some(item => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) { toast('Такая тема уже есть'); return }
      topic.name = name
      save(); break
    }
    case 'drop-ask': ui.dropTopic = el.dataset.n || null; break
    case 'drop-no': ui.dropTopic = null; break
    case 'deltopic': {
      const id = el.dataset.n || ''
      const topic = state.topics.find(item => item.id === id)
      if (!topic || topic.builtin || ui.dropTopic !== id) return
      let moved = 0
      for (const word of state.words) {
        if (word.topic !== id) continue
        word.topic = 'my'
        moved += 1
      }
      state.topics = state.topics.filter(item => item.id !== id)
      state.lv = state.lv.filter(item => item !== id)
      if (!state.lv.length) state.lv = ['greet']
      ui.dropTopic = null
      ui.folder = null
      ui.showFolders = true
      ui.focusTopic = null
      save()
      if (moved) toast(`Слова перенесены в «Мои слова»: ${moved}`)
      break
    }
    case 'voice': state.settings.voice = el.dataset.v === 'dict' || el.dataset.v === 'system' ? el.dataset.v : 'auto'; save(); break
    case 'rate': state.settings.rate = Number(el.dataset.v) || 1; save(); break
    case 'theme': {
      const theme = el.dataset.v
      state.settings.theme = theme === 'light' || theme === 'dark' || theme === 'jade' || theme === 'paper' || theme === 'ink' ? theme : 'auto'
      save(); applyTheme(); break
    }
    case 'goal': state.settings.goal = [10, 20, 30, 50].includes(Number(el.dataset.v)) ? Number(el.dataset.v) : 0; save(); break
    case 'gram': {
      const id = el.dataset.id || ''
      if (!id) return
      const level = Number(el.dataset.lv)
      if (level >= 1 && level <= 6) ui.gramOpen = level
      state.gram = state.gram.includes(id) ? state.gram.filter(item => item !== id) : state.gram.concat(id)
      persist(); break
    }
    case 'tc': state.settings.tc = Number(el.dataset.v) === 2 ? 2 : Number(el.dataset.v) === 0 ? 0 : 1; save(); break
    case 'perday': state.settings.perDay = Number(el.dataset.v) || 20; save(); break
    case 'flag': {
      const key = el.dataset.k
      const checked = (el as HTMLInputElement).checked
      if (key === 'pyFront' || key === 'strict') state.settings[key] = checked
      save(); break
    }
    case 'exp': exportFile(); return
    case 'reset-ask': ui.confirmReset = true; break
    case 'reset-no': ui.confirmReset = false; break
    case 'reset-yes': resetState(); ui.confirmReset = false; ui.view = 'study'; toast('Всё стёрто'); break
    default: return
  }
  draw()
}

document.body.addEventListener('click', event => {
  const el = (event.target as HTMLElement).closest('[data-act]') as HTMLElement | null
  if (!el) return
  void act(el.dataset.act || '', el)
})

document.addEventListener('keydown', event => {
  const tag = (event.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (ui.view === 'study' && ui.study?.ids.length) {
    if (event.key === ' ' && !ui.study.show) { event.preventDefault(); void act('show', document.body) }
    if (ui.study.show) {
      const grade = event.key === '1' ? 'again' : event.key === '2' ? 'hard' : event.key === '3' ? 'good' : event.key === '4' ? 'easy' : ''
      if (grade) void act('grade', btn(grade))
    }
    if (event.key === '5') {
      const word = findWord(state, ui.study.ids[0])
      if (word) void speak(word.hanzi, word.pinyin)
    }
  }
  if (ui.view === 'quiz' && ui.quiz && ui.quiz.kind !== 'say' && ui.quiz.i < ui.quiz.items.length && ui.quiz.items[ui.quiz.i].pick == null) {
    const index = Number(event.key) - 1
    if (index >= 0 && index <= 3) void act('qpick', btn(String(index), 'k'))
  }
})

function btn(value: string, attr = 'g'): HTMLElement {
  const el = document.createElement('button')
  el.dataset[attr] = value
  return el
}

load()
applyTheme()
draw()
