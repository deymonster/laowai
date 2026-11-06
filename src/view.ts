import { ACH } from './achieve'
import { GRAMMAR, HSK } from './grammar'
import { clozeText, esc, hanChars, ruNoun } from './han'
import { canQuiz, quizBlurb } from './quiz'
import { compose, pyHTML, searchKey, toneOf, type Reading } from './pinyin'
import { blankEditor, ui, type Editor } from './session'
import { findWord, getP, inTopic, selectedWords, statusOf, streak, today, topicCount, buildQueue, dueLabel, nextDue, type Grade } from './srs'
import { RATES, state } from './store'
import type { Word } from './types'

const GRID = '<svg class="gr" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 L100 100 M100 0 L0 100 M50 0 V100 M0 50 H100"/></svg>'
const TABS: [typeof ui.view, string][] = [['study', 'Учить'], ['quiz', 'Тест'], ['gram', 'Грамм.'], ['list', 'Слова'], ['write', 'Письмо'], ['prog', 'Прогресс']]
const POS = ['', 'сущ.', 'гл.', 'прил.', 'нареч.', 'числ.', 'мест.', 'счётн.', 'предл.', 'союз', 'част.', 'межд.', 'прист.', 'суфф.', 'фраза']

function seg(items: [string, string][], current: string, act: string): string {
  return `<div class="seg" role="group">${items.map(([value, label]) => `<button type="button" data-act="${act}" data-v="${esc(value)}" aria-pressed="${current === value}">${esc(label)}</button>`).join('')}</div>`
}

function topicName(id: string): string {
  return state.topics.find(topic => topic.id === id)?.name || id
}

function levelBar(): string {
  return `<p class="barlabel">Уровень</p><div class="topics" role="group" aria-label="Уровни HSK">${HSK.map(level => {
    const on = state.hsk.includes(level)
    const count = state.words.filter(word => word.level === level).length
    return `<button type="button" class="chip${on ? ' on' : ''}" data-act="hsk" data-n="${level}" aria-pressed="${on}" aria-label="Уровень HSK ${level}, ${count}" title="Слова этой ступени во всех списках"><span>HSK ${level}</span><small>${count}</small></button>`
  }).join('')}</div>`
}

function topicBar(): string {
  const busy = (ui.view === 'study' && ui.study) || (ui.view === 'quiz' && ui.quiz) || (ui.view === 'write' && ui.type)
  if (ui.view === 'edit' || ui.view === 'set' || ui.view === 'list' || busy) return ''
  if (ui.view === 'gram') return levelBar()
  return `${levelBar()}<p class="hint">Уровень отсекает ступень в учёбе и тестах. Список выбирает слова, нажатие открывает их.</p><p class="barlabel">Списки</p>${topicChips()}`
}

function topicChips(): string {
  return `<div class="topics" role="group" aria-label="Списки">${state.topics.map(topic => {
    const on = state.lv.includes(topic.id)
    const count = topicCount(state, topic.id)
    return `<button type="button" class="chip${on ? ' on' : ''}" data-act="lv" data-n="${esc(topic.id)}" aria-pressed="${on}" aria-label="${esc(topic.name)}, ${count}" title="Слова в этом списке"><span>${esc(topic.name)}</span><small>${count}</small></button>`
  }).join('')}</div>`
}

function cells(word: Word): string {
  const chars = [...word.hanzi]
  const hans = hanChars(word.hanzi)
  const syl = word.pinyin.split(/\s+/).filter(Boolean)
  const color = state.settings.tc >= 2 && syl.length === hans.length
  let index = 0
  const size = chars.length > 8 ? 'xs' : chars.length > 5 ? 'sm' : ''
  return `<div class="cells ${size}" lang="zh-Hans">${chars.map(ch => {
    if (!/\p{Script=Han}/u.test(ch)) return `<span class="pc">${esc(ch)}</span>`
    const tone = color ? toneOf(syl[index++] || '') : 0
    return `<span class="cell${tone ? ` t${tone}` : ''}">${GRID}<b>${esc(ch)}</b></span>`
  }).join('')}</div>`
}

function pinyinLine(word: Word): string {
  if (!state.settings.tc) return `<div class="py">${esc(word.pinyin)}</div>`
  return `<div class="py">${pyHTML(word.pinyin, esc)}</div>`
}

function shownPy(pinyin: string): string {
  if (!pinyin) return ''
  return state.settings.tc ? pyHTML(pinyin, esc) : esc(pinyin)
}

export function writeGlossInner(): string {
  const gloss = ui.gloss
  if (!gloss.char) return '<p class="muted">Введите иероглиф, и появятся чтение и перевод.</p>'
  const alts = gloss.alts.length ? ` <span class="muted">также ${gloss.alts.map(item => shownPy(item)).join(', ')}</span>` : ''
  const reading = gloss.py ? `${shownPy(gloss.py)}${alts}` : '<span class="muted">…</span>'
  const meaning = gloss.ru ? esc(gloss.ru) : `<span class="muted">${esc(gloss.note || 'Ищем перевод…')}</span>`
  const word = gloss.wordHan ? `<p class="muted">Слово ${esc(gloss.wordHan)}${gloss.wordPy ? ` · ${shownPy(gloss.wordPy)}` : ''}${gloss.wordRu ? ` · ${esc(gloss.wordRu)}` : ''}</p>` : ''
  return `<b class="hz" lang="zh-Hans">${esc(gloss.char)}</b><div class="py">${reading}</div><div class="glossru">${meaning}</div>${word}`
}

function speakBtn(text: string, label: string, pinyin = ''): string {
  return `<button type="button" class="icon" data-act="speak" data-t="${esc(text)}" data-py="${esc(pinyin)}" aria-label="${esc(label)}">▶</button>`
}

export function dictHitHtml(hits: { hanzi: string; pinyin: string; ru: string }[]): string {
  return hits.map((hit, index) => `<button type="button" class="hit" data-act="pickword" data-i="${index}"><b lang="zh-Hans">${esc(hit.hanzi)}</b>${hit.pinyin ? `<span>${esc(hit.pinyin)}</span>` : ''}${hit.ru ? `<small>${esc(hit.ru)}</small>` : ''}</button>`).join('')
}

function starBtn(word: Word): string {
  const on = state.my.includes(word.id) || word.topic === 'my'
  return `<button type="button" class="icon star${on ? ' on' : ''}" data-act="star" data-id="${esc(word.id)}" aria-pressed="${on}" aria-label="${on ? 'Убрать из моих слов' : 'В мои слова'}">★</button>`
}

function wordCard(word: Word, front: 'han' | 'ru', show: boolean, samples = true): string {
  const py = pinyinLine(word)
  const han = cells(word)
  const ru = `<div class="ru">${esc(word.ru)}</div>`
  const more = samples ? extra(word) : ''
  const face = front === 'han' ? han + (state.settings.pyFront ? py : '') : ru
  const back = !show ? '' : front === 'han'
    ? `${state.settings.pyFront ? '' : py}${ru}${word.pos ? `<div class="pos">${esc(word.pos)}</div>` : ''}${more}`
    : `${han}${py}${more}`
  return face + (back ? `<div class="reveal">${back}</div>` : '')
}

function sampleBlock(hanzi: string, py: string, ru: string): string {
  if (!hanzi) return ''
  const reading = state.settings.tc ? pyHTML(py, esc) : esc(py)
  return `<div class="ex"><div class="exh"><span lang="zh-Hans">${esc(hanzi)}</span>${speakBtn(hanzi, 'Произнести пример', py)}</div>${py ? `<div class="py">${reading}</div>` : ''}<div>${esc(ru)}</div></div>`
}

function extra(word: Word): string {
  const samples = [sampleBlock(word.example, word.examplePy, word.exampleRu), ...(word.uses || []).map(item => sampleBlock(item.hanzi, item.py, item.ru))].join('')
  return `${word.note ? `<p class="note">${esc(word.note)}</p>` : ''}${samples}`
}

function phraseLines(word: Word): string {
  const samples = [
    ...(word.example ? [{ hanzi: word.example, py: word.examplePy, ru: word.exampleRu }] : []),
    ...(word.uses || []),
  ].filter(item => item.hanzi)
  if (!samples.length) return ''
  return `<span class="phrases">${samples.map(item => {
    const reading = item.py ? `<span class="py">${state.settings.tc ? pyHTML(item.py, esc) : esc(item.py)}</span>` : ''
    return `<span class="phrase"><span class="hzbit" lang="zh-Hans">${esc(item.hanzi)}</span>${reading}${item.ru ? ` <span>${esc(item.ru)}</span>` : ''}</span>`
  }).join('')}</span>`
}

function studyView(): string {
  const queue = buildQueue(state)
  if (!ui.study) {
    const total = queue.ids.length
    let body = ''
    if (!selectedWords(state).length) body = '<div class="empty"><h2>В выбранных уровнях и подборках пусто</h2><p>Включите уровень HSK или подборку. Новое слово можно добавить в «Словах».</p></div>'
    else if (total) body = `<div class="stats"><div><b>${queue.due}</b><span>к повторению</span></div><div><b>${queue.allow}</b><span>новых</span></div><div><b>${queue.fresh}</b><span>ещё не начато</span></div></div><p class="field">Направление</p>${seg([['h2r', 'Иероглиф → перевод'], ['r2h', 'Перевод → иероглиф']], state.settings.dir, 'dir')}<button type="button" class="btn primary block" data-act="start">Начать · ${total}</button>`
    else body = `<div class="empty"><h2>На сегодня всё</h2><p>${queue.fresh ? 'Дневной лимит новых слов выполнен.' : 'Новых слов и повторов нет.'}</p>${queue.fresh ? '<button type="button" class="btn primary" data-act="more">Ещё 10 новых</button>' : ''}</div>`
    const narrow = state.hsk.length < HSK.length ? ` · HSK ${state.hsk.join(', ')}` : ''
    return `<section class="card"><h2>Сегодня · ${esc(state.lv.map(topicName).join(', '))}${esc(narrow)}</h2>${goal()}${body}</section>`
  }
  const sess = ui.study
  if (!sess.ids.length) return `<section class="card"><div class="empty"><h2>Сессия закончена</h2><p>Карточек: ${sess.total}. Ошибок: ${sess.failed.length}.</p></div><button type="button" class="btn primary block" data-act="stop">Готово</button></section>`
  const word = findWord(state, sess.ids[0])
  if (!word) return ''
  const kind = sess.failed.includes(word.id) ? 'Ещё раз' : sess.kind[word.id] === 'new' ? 'Новое' : 'Повторение'
  const grades = sess.show ? gradeButtons(word.id) : '<button type="button" class="btn primary block" data-act="show">Показать ответ</button><p class="kbd">Пробел показывает ответ, 1–4 ставят оценку, 5 включает звук</p>'
  return `<section class="card"><div class="rowtop"><span class="tag">${esc(topicName(word.topic))}</span><span class="tag">HSK ${word.level}</span><span class="tag">${kind} · ${sess.n} / ${sess.total}</span><span class="tools">${starBtn(word)}${speakBtn(word.hanzi, 'Произнести', word.pinyin)}</span></div><div class="prog"><i style="width:${Math.round(sess.n / sess.total * 100)}%"></i></div>${wordCard(word, state.settings.dir === 'h2r' ? 'han' : 'ru', sess.show, false)}${grades}${sess.show ? extra(word) : ''}</section><p class="center"><button type="button" class="btn tiny" data-act="stop">Завершить</button></p>`
}

function gradeWhen(grade: Grade, wait: number): string {
  if (grade === 'again') return 'сейчас'
  if (wait <= 0) return 'позже'
  return dueLabel(wait)
}

function gradeButtons(id: string): string {
  const items: [Grade, string][] = [['again', 'Не помню'], ['hard', 'С трудом'], ['good', 'Помню'], ['easy', 'Легко']]
  return `<div class="grades">${items.map(([grade, label]) => `<button type="button" class="${grade}" data-act="grade" data-g="${grade}">${label}<small>${gradeWhen(grade, nextDue(state, id, grade))}</small></button>`).join('')}</div>`
}

function goal(): string {
  const target = state.settings.goal || 0
  const done = state.days[String(today())] || 0
  const run = streak(state)
  const series = run ? ` · серия <b>${run}</b>` : ''
  if (!target) return `<p class="goal">Сегодня <b>${done}</b> ${ruNoun(done, 'ответ', 'ответа', 'ответов')}${series}</p>`
  const width = Math.min(100, Math.round(done / target * 100))
  return `<p class="goal">Цель на день: <b>${Math.min(done, target)}</b> из <b>${target}</b>${series}</p><div class="bar"><i style="width:${width}%"></i></div>`
}

function quizView(): string {
  const kinds: [typeof ui.quizKind, string][] = [['h2r', 'Иероглиф → перевод'], ['r2h', 'Перевод → иероглиф'], ['h2p', 'Иероглиф → пиньинь'], ['aud', 'На слух'], ['sent', 'Фраза'], ['cloze', 'Пропуск'], ['gram', 'Правило'], ['speed', 'На скорость']]
  if (!ui.quiz) {
    const can = canQuiz(ui.quizKind)
    const start = ui.quizKind === 'speed' ? 'Старт · 60 секунд' : 'Начать тест'
    const lack = ui.quizKind === 'sent' || ui.quizKind === 'cloze'
      ? 'В выбранных списках мало примеров. Другие списки в этот тест не попадают.'
      : 'Для этого режима пока мало слов. Выберите другие списки или другой тест.'
    return `<section class="card"><h2>Тест</h2>${seg(kinds, ui.quizKind, 'qkind')}<p class="muted">${esc(quizBlurb(ui.quizKind))}</p>${can ? '' : `<p class="muted">${lack}</p>`}<button type="button" class="btn primary block" data-act="qstart"${can ? '' : ' disabled'}>${start}</button></section>`
  }
  const quiz = ui.quiz
  if (quiz.i >= quiz.items.length) {
    const title = quiz.kind === 'speed' ? `${quiz.ok} за минуту` : `${quiz.ok} из ${quiz.items.length}`
    const note = quiz.kind === 'speed' ? `Рекорд: ${state.rec}.` : `${Math.round(quiz.ok / quiz.items.length * 100)}% верно.`
    return `<section class="card"><div class="empty"><h2>${title}</h2><p>${note}</p></div>${mistakes(quiz.bad)}<div class="grades"><button type="button" class="good" data-act="qagain">Ещё раз</button><button type="button" data-act="qstop">Закрыть</button></div></section>`
  }
  const item = quiz.items[quiz.i]
  const word = findWord(state, item.id)
  const rule = GRAMMAR.find(entry => entry.id === item.id)
  if (!word && !rule) return ''
  const done = item.pick != null
  const prompt = quiz.kind === 'gram' && rule ? `<div class="hz" lang="zh-Hans">${esc(rule.example)}</div><div class="py">${esc(rule.examplePy)}</div><p class="muted center">Что означает пример?</p>`
    : !word ? ''
    : quiz.kind === 'r2h' ? `<div class="ru">${esc(word.ru)}</div>`
    : quiz.kind === 'cloze' ? `<div class="hz" lang="zh-Hans">${esc(clozeText(word.example, word.hanzi))}</div><p class="muted center">${esc(word.exampleRu)}</p>`
    : quiz.kind === 'sent' ? `${speakBtn(word.example, 'Послушать ещё', word.examplePy)}<p class="muted center">Что сказано в примере?</p>`
    : quiz.kind === 'aud' ? `${speakBtn(word.hanzi, 'Послушать ещё', word.pinyin)}<p class="muted center">Какое слово вы слышите?</p>`
    : cells(word)
  const hanOpt = quiz.kind === 'r2h' || quiz.kind === 'aud' || quiz.kind === 'cloze'
  const opts = item.opts.map((opt, index) => {
    const cls = done ? opt.ok ? 'ok' : index === item.pick ? 'no' : '' : ''
    const inner = quiz.kind === 'h2p' ? `<span class="py">${esc(opt.text)}</span>` : hanOpt ? `<span lang="zh-Hans">${esc(opt.text)}</span>` : esc(opt.text)
    return `<button type="button" class="opt ${cls}" data-act="qpick" data-k="${index}"${done ? ' disabled' : ''}><span>${index + 1}</span>${inner}</button>`
  }).join('')
  const answer = word ? `${esc(word.hanzi)} · ${esc(word.pinyin)} · ${esc(word.ru)}` : rule ? `${esc(rule.example)} — ${esc(rule.exampleRu)}` : ''
  const after = done && quiz.kind !== 'speed' ? `<div class="answer">${answer}</div><button type="button" class="btn primary block" data-act="qnext">${quiz.i + 1 >= quiz.items.length ? 'Результат' : 'Дальше'}</button>` : ''
  const clock = quiz.kind === 'speed' ? `<b class="qclock" id="qclock">${Math.max(0, Math.ceil((quiz.until - Date.now()) / 1000))} с</b>` : ''
  const listen = word && quiz.kind !== 'aud' && quiz.kind !== 'sent' && quiz.kind !== 'gram' ? speakBtn(word.hanzi, 'Произнести', word.pinyin) : ''
  return `<section class="card"><div class="rowtop"><span class="tag">${quiz.kind === 'speed' ? `Счёт ${quiz.ok}` : `Вопрос ${quiz.i + 1} / ${quiz.items.length}`}</span>${clock}${listen}</div><div class="q">${prompt}</div><div class="opts">${opts}</div>${after}</section><p class="center"><button type="button" class="btn tiny" data-act="qstop">Выйти</button></p>`
}

function gramView(): string {
  const shown = HSK.filter(level => state.hsk.includes(level))
  const rules = GRAMMAR.filter(rule => shown.includes(rule.level))
  const done = rules.filter(rule => state.gram.includes(rule.id)).length
  const body = shown.map(level => {
    const items = GRAMMAR.filter(rule => rule.level === level).map(rule => {
      const on = state.gram.includes(rule.id)
      return `<button type="button" class="rule${on ? ' on' : ''}" data-act="gram" data-id="${esc(rule.id)}" aria-pressed="${on}"><b>${esc(rule.title)}</b><span>${esc(rule.rule)}</span><span lang="zh-Hans">${esc(rule.example)}</span><span class="py">${esc(rule.examplePy)}</span><small>${esc(rule.exampleRu)}</small></button>`
    }).join('')
    return `<h3 class="band">HSK ${level}</h3>${items}`
  }).join('')
  return `<section class="card"><h2>Грамматика</h2><p class="muted">Правила по ступеням HSK. Нажмите правило, если оно уже понятно. В тест попадают включённые уровни. ${done} из ${rules.length}.</p>${body || '<p class="muted">Включите хотя бы один уровень.</p>'}</section>`
}

function mistakes(ids: string[]): string {
  if (!ids.length) return ''
  return `<div class="mist">${ids.map(id => {
    const word = findWord(state, id)
    if (word) return `<p><b lang="zh-Hans">${esc(word.hanzi)}</b> ${esc(word.pinyin)} — ${esc(word.ru)}</p>`
    const rule = GRAMMAR.find(item => item.id === id)
    return rule ? `<p><b>${esc(rule.title)}</b> — ${esc(rule.exampleRu)}</p>` : ''
  }).join('')}</div>`
}

function matches(word: Word): boolean {
  if (ui.folder) {
    if (!inTopic(state, word, ui.folder)) return false
  } else if (!state.lv.some(id => inTopic(state, word, id))) return false
  const st = statusOf(getP(state, word.id).b)
  if (ui.status !== 'all' && st !== ui.status) return false
  const q = searchKey(ui.q.trim())
  if (!q) return true
  const hay = searchKey(`${word.hanzi} ${word.pinyin} ${word.ru} ${word.note}`)
  const bare = q.replace(/[1-5]/g, '')
  return hay.includes(q) || (!!bare && (hay.includes(bare) || hay.replace(/[1-5]/g, '').includes(bare)))
}

function wordArticle(word: Word): string {
  const open = ui.openId === word.id
  const st = statusOf(getP(state, word.id).b)
  const mark = st === 'new' ? 'новое' : st === 'done' ? 'выучено' : 'учу'
  return `<article class="word"><button type="button" class="wordhead" data-act="open" data-id="${esc(word.id)}"><span class="hz" lang="zh-Hans">${esc(word.hanzi)}</span><span><b class="py">${esc(word.pinyin)}</b><small>${esc(word.ru)}</small></span><em>HSK ${word.level} · ${mark}</em>${phraseLines(word)}</button>${open ? `<div class="wordbody">${speakBtn(word.hanzi, 'Произнести', word.pinyin)}${starBtn(word)}<button type="button" class="btn tiny" data-act="edit" data-id="${esc(word.id)}">Изменить</button>${word.custom ? `<button type="button" class="btn tiny danger" data-act="del" data-id="${esc(word.id)}">Удалить</button>` : ''}${extra(word)}</div>` : ''}</article>`
}

function selectedTopics(): string[] {
  const ids = state.lv.length ? state.lv : ['greet']
  return ids.filter(id => state.topics.some(topic => topic.id === id))
}

const LIST_PAGE = 800

function listPage(items: Word[]): { shown: Word[]; rest: number } {
  const limit = LIST_PAGE + ui.listExtra
  return { shown: items.slice(0, limit), rest: Math.max(0, items.length - limit) }
}

function moreButton(rest: number): string {
  if (!rest) return ''
  return `<p class="center"><button type="button" class="btn" data-act="listmore">Показать ещё ${Math.min(LIST_PAGE, rest)}</button></p>`
}

export function listResults(): string {
  const items = state.words.filter(matches)
  const filtering = !!(ui.q.trim() || ui.status !== 'all')
  if (ui.folder) {
    if (!items.length) return `<div class="empty"><p>${filtering ? 'Ничего не найдено.' : 'В этой подборке пока нет слов.'}</p></div>`
    const page = listPage(items)
    return `<p class="muted">В списке: ${items.length}</p>` + page.shown.map(wordArticle).join('') + moreButton(page.rest)
  }
  const topics = selectedTopics()
  const focus = ui.focusTopic && topics.includes(ui.focusTopic) ? ui.focusTopic : ''
  const order = focus ? [focus, ...topics.filter(id => id !== focus)] : topics
  const placed = new Set<string>()
  let room = LIST_PAGE + ui.listExtra
  let rest = 0
  const groups = order.map(id => {
    const group = items.filter(word => {
      if (placed.has(word.id)) return false
      if (word.topic === id) return true
      return id === 'my' && state.my.includes(word.id)
    })
    group.forEach(word => placed.add(word.id))
    const shown = group.slice(0, Math.max(0, room))
    room -= shown.length
    rest += group.length - shown.length
    if (!shown.length) return filtering || group.length ? '' : `<h3 class="band" id="topic-${esc(id)}">${esc(topicName(id))}</h3><p class="muted">В этой подборке пока нет слов.</p>`
    return `<h3 class="band" id="topic-${esc(id)}">${esc(topicName(id))}</h3>` + shown.map(wordArticle).join('')
  }).join('')
  if (!groups && !items.length) return `<div class="empty"><p>${filtering ? 'Ничего не найдено.' : 'Отметьте подборку, и её слова появятся в списке.'}</p></div>`
  return `<p class="muted">В списке: ${items.length}</p>${groups}${moreButton(rest)}`
}

function wordsLabel(count: number): string {
  return `${count} ${ruNoun(count, 'слово', 'слова', 'слов')}`
}

function folderList(): string {
  return `<section class="card"><h2>Подборки</h2><p class="hint">Списки HSK уже есть. Своя подборка создаётся здесь, слова в ней можно удалить вместе с ней или оставить в «Моих словах».</p><div class="addtopic"><input id="newtopic" type="text" placeholder="Новая подборка" aria-label="Название подборки" maxlength="40"><button type="button" class="btn" data-act="newtopic">Создать</button></div><div class="folders">${state.topics.map(topic => `<button type="button" class="folder" data-act="folder" data-n="${esc(topic.id)}"><span><b>${esc(topic.name)}</b><small>${wordsLabel(topicCount(state, topic.id))}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div></section>`
}

function wordTools(): string {
  return `<div class="search"><input id="q" type="search" placeholder="Поиск: иероглиф, пиньинь или перевод" value="${esc(ui.q)}" aria-label="Поиск" autocomplete="off"></div>${seg([['all', 'Все'], ['new', 'Новые'], ['learn', 'Учу'], ['done', 'Выучено']], ui.status, 'status')}<div class="acts"><button type="button" class="btn primary" data-act="add">Добавить слово</button></div><div id="results">${listResults()}</div>`
}

function selectedList(): string {
  return `<section class="card"><div class="rowtop"><h2>Слова</h2><button type="button" class="btn tiny" data-act="folders">Подборки</button></div><p class="hint">Отметьте подборку — её слова будут в этом списке. HSK 1–6 уже готовы. Своя категория создаётся в «Подборках».</p>${topicChips()}${wordTools()}</section>`
}

function listView(): string {
  if (ui.showFolders && !ui.folder) return folderList()
  const topic = state.topics.find(item => item.id === ui.folder)
  if (!topic) return selectedList()
  const levels = state.hsk.length ? state.hsk : [1, 2, 3, 4, 5, 6]
  const outside = state.words.filter(word => inTopic(state, word, topic.id) && !levels.includes(word.level || 1)).length
  const levelNote = outside ? `<p class="hint">${outside} не попадут в учёбу и тесты: их уровень HSK сейчас выключен. В этом списке они есть.</p>` : ''
  const own = topic.builtin ? '' : `<div class="addtopic"><input id="renametopic" value="${esc(topic.name)}" maxlength="40" aria-label="Новое название"><button type="button" class="btn" data-act="rentopic" data-n="${esc(topic.id)}">Переименовать</button></div>${ui.dropTopic === topic.id ? `<div class="confirm"><span>Удалить подборку? Её слова останутся в «Моих словах».</span><button type="button" class="btn danger" data-act="deltopic" data-n="${esc(topic.id)}">Удалить</button><button type="button" class="btn" data-act="drop-no">Отмена</button></div>` : `<button type="button" class="btn danger" data-act="drop-ask" data-n="${esc(topic.id)}">Удалить подборку</button>`}`
  return `<section class="card"><div class="rowtop"><button type="button" class="btn tiny" data-act="folders">Все подборки</button><h2>${esc(topic.name)}</h2><span class="tag">${wordsLabel(topicCount(state, topic.id))}</span></div><p class="hint">Новое слово сохранится в эту подборку. Примеры фраз показаны у каждого слова.</p>${own}${levelNote}${wordTools()}</section>`
}

export function readingExtras(parts: Reading[], picks: Record<number, string>, scope: 'word' | 'ex'): string {
  const text = compose(parts, picks)
  const multi = parts.map((part, index) => ({ part, index })).filter(item => item.part.han && item.part.options.length > 1)
  const hint = text ? `<p class="hint">Чтение по словарю${scope === 'ex' ? ' для примера' : ''}: ${pyHTML(text, esc)}</p>` : '<p class="hint">Введите иероглифы, чтение подставится само.</p>'
  if (!multi.length) return hint
  const chips = multi.map(({ part, index }) => {
    const chosen = picks[index] && part.options.includes(picks[index]) ? picks[index] : part.value
    return `<div class="syl"><b lang="zh-Hans">${esc(part.ch)}</b>${part.options.map(option => `<button type="button" data-act="pypick" data-which="${scope}" data-i="${index}" data-v="${esc(option)}" aria-pressed="${option === chosen}">${pyHTML(option, esc)}</button>`).join('')}</div>`
  }).join('')
  return `${hint}<div class="syls">${chips}</div><p class="hint">Если у иероглифа несколько чтений, для слова выбрано словарное. Нажмите другое, если имелось в виду оно.</p>`
}

function editView(): string {
  const editor = ui.editor || blankEditor('my')
  const topicOptions = state.topics.map(topic => `<option value="${esc(topic.id)}"${topic.id === editor.topic ? ' selected' : ''}>${esc(topic.name)}</option>`).join('')
  const posOptions = POS.map(pos => `<option value="${esc(pos)}"${pos === editor.pos ? ' selected' : ''}>${esc(pos || 'часть речи')}</option>`).join('')
  const hskOptions = HSK.map(level => `<option value="${level}"${level === editor.level ? ' selected' : ''}>HSK ${level}</option>`).join('')
  const lockTopic = !editor.id && !!(ui.folder || state.lv.length <= 1)
  return `<section class="card"><div class="rowtop"><h2>${editor.id ? 'Изменить слово' : 'Новое слово'}</h2><button type="button" class="btn tiny" data-act="back">Назад</button></div><label class="field">Найти слово<input id="f-q" value="${esc(editor.query)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="привет, 银行 или yinhang" aria-label="Найти слово"></label><p class="hint">Русское слово, иероглифы или пиньинь. Перевод берётся из БКРС, чтение считается по слову.</p><p class="hint" id="lookupmsg">${esc(editor.lookupMsg)}</p><div id="hits" class="hits">${dictHitHtml(editor.hits)}</div><label class="field">Иероглифы<input id="f-han" lang="zh-Hans" value="${esc(editor.hanzi)}" autocomplete="off" autocapitalize="off" placeholder="例如 银行"></label><label class="check"><input id="f-sur" type="checkbox"${editor.surname ? ' checked' : ''}> Читать первый знак как фамилию</label><label class="field">Пиньинь<input id="f-py" value="${esc(editor.pinyin)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="подставится само, можно ni3 hao3"></label><div class="acts"><button type="button" class="btn tiny" data-act="pyreset">Снова из иероглифов</button>${speakBtn(editor.hanzi, 'Прослушать слово', editor.pinyin)}</div><div id="pybox">${editor.loading ? '<p class="hint">Подбираем чтение…</p>' : readingExtras(editor.parts, editor.picks, 'word')}</div><p class="warn" id="editwarn">${esc(editor.warn)}</p><label class="field">Перевод<input id="f-ru" value="${esc(editor.ru)}" placeholder="банк"></label><label class="field">Часть речи<select id="f-pos">${posOptions}</select></label><label class="field">Уровень HSK<select id="f-hsk">${hskOptions}</select></label>${lockTopic ? `<p class="hint">Слово сохранится в подборку «${esc(topicName(editor.topic))}».</p>` : `<label class="field">Подборка<select id="f-topic">${topicOptions}</select></label>`}<label class="field">Заметка<textarea id="f-note" rows="2">${esc(editor.note)}</textarea></label><label class="field">Пример<input id="f-ex" lang="zh-Hans" value="${esc(editor.example)}" autocomplete="off" placeholder="我去银行。"></label><label class="field">Пиньинь примера<input id="f-expy" value="${esc(editor.examplePy)}" autocomplete="off" spellcheck="false"></label><div id="exbox">${readingExtras(editor.exampleParts, editor.examplePicks, 'ex')}</div><label class="field">Перевод примера<input id="f-exru" value="${esc(editor.exampleRu)}"></label>${editor.error ? `<p class="error">${esc(editor.error)}</p>` : ''}<button type="button" class="btn primary block" data-act="save">Сохранить</button></section>`
}

function writePicks(): string {
  const topics = state.lv.length ? state.lv : ['greet']
  return topics.map(id => {
    const words = selectedWords(state).filter(word => inTopic(state, word, id) && hanChars(word.hanzi).length <= 4).slice(0, 30)
    if (!words.length) return ''
    const chips = words.map(word => `<button type="button" class="chip pick" data-act="wpick" data-h="${esc(word.hanzi)}"><b lang="zh-Hans">${esc(word.hanzi)}</b><small>${esc(word.pinyin)} · ${esc(word.ru)}</small></button>`).join('')
    return `<h3 class="band">${esc(topicName(id))}</h3><div class="picks">${chips}</div>`
  }).join('')
}

function strokeView(): string {
  const chars = hanChars(ui.writeText).slice(0, 8)
  const chips = chars.map((ch, index) => `<button type="button" class="chip hz${index === ui.writeCi ? ' on' : ''}" data-act="wchar" data-i="${index}" lang="zh-Hans">${esc(ch)}</button>`).join('')
  const picks = writePicks()
  return `<section class="card"><h2>Порядок черт</h2><details><summary>Правила написания</summary><ol class="rules"><li>Сверху вниз.</li><li>Слева направо.</li><li>Горизонталь раньше вертикали, если они пересекаются.</li><li>Сначала левая и верхняя стороны рамки, потом содержимое, рамку закрывают в конце.</li><li>У симметричного знака сначала середина.</li><li>Точка справа и мелкие черты чаще в конце.</li></ol><p class="muted">Ввод пиньиня: тоны цифрами, <b>ni3 hao3</b>. Буква <b>ü</b> вводится как <b>v</b>.</p></details><div class="search"><input id="wtxt" lang="zh-Hans" value="${esc(ui.writeText)}" placeholder="Иероглиф или слово" aria-label="Иероглиф" autocomplete="off"></div><div class="topics" id="wchars">${chips}</div><div class="gloss" id="wgloss">${writeGlossInner()}</div>${seg([['watch', 'Смотреть'], ['quiz', 'Обводить']], ui.strokePlay, 'smode')}<div id="writer" class="writer"></div><p class="muted center" id="strokeMsg">${esc(ui.strokeMsg)}</p><div class="acts center">${ui.strokePlay === 'watch' ? `<button type="button" class="btn" data-act="wplay">Показать</button><button type="button" class="btn" data-act="wstep">По одной черте</button><button type="button" class="btn" data-act="wslow" aria-pressed="${ui.strokeSlow}">Медленно${ui.strokeSlow ? ' ✓' : ''}</button><button type="button" class="btn" data-act="wreset">Сначала</button>` : '<button type="button" class="btn" data-act="wplay">Начать обводку</button>'}</div>${picks}</section>`
}

function typeView(): string {
  if (!ui.type) {
    const can = selectedWords(state).length >= 1
    return `<section class="card"><h2>Писать</h2><p class="muted">Тоны можно цифрами: ni3 hao3. Буква ü вводится как v.</p>${seg([['py', 'Пиньинь по иероглифам'], ['hz', 'Иероглифы по переводу']], ui.typeMode, 'tmode')}${can ? '' : '<p class="muted">Сначала выберите тему, в которой есть слова.</p>'}<button type="button" class="btn primary block" data-act="tstart"${can ? '' : ' disabled'}>Начать · 10 слов</button></section>`
  }
  const sess = ui.type
  if (sess.i >= sess.ids.length) return `<section class="card"><div class="empty"><h2>${sess.ok} из ${sess.ids.length}</h2></div>${mistakes(sess.bad)}<button type="button" class="btn primary block" data-act="tstop">Закрыть</button></section>`
  const word = findWord(state, sess.ids[sess.i])
  if (!word) return ''
  const prompt = sess.mode === 'py' ? `${cells(word)}<div class="ru">${esc(word.ru)}</div>` : `<div class="ru">${esc(word.ru)}</div>${pinyinLine(word)}`
  const body = sess.res ? `<div class="answer"><b>${sess.res.r === 'ok' ? 'Верно' : sess.res.r === 'ok-nt' ? 'Верно, без тонов' : sess.res.r === 'tone' ? 'Слог верный, тон другой' : sess.res.r === 'empty' ? 'Пустой ответ' : 'Неверно'}</b><span>${esc(word.hanzi)} · ${esc(word.pinyin)}</span>${sess.res.val ? `<span>Ваш ответ: ${esc(sess.res.val)}</span>` : ''}</div><button type="button" class="btn primary block" data-act="tnext">Дальше</button>` : `<input id="ans" class="${sess.mode === 'hz' ? 'hz' : ''}" placeholder="${sess.mode === 'py' ? 'пиньинь' : 'иероглифы'}" aria-label="Ответ" autocomplete="off" autocapitalize="off" spellcheck="false"><div class="grades"><button type="button" class="good" data-act="tcheck">Проверить</button><button type="button" data-act="tskip">Не знаю</button></div>`
  return `<section class="card"><div class="rowtop"><span class="tag">${sess.i + 1} / ${sess.ids.length}</span>${speakBtn(word.hanzi, 'Произнести', word.pinyin)}</div>${prompt}${body}</section><p class="center"><button type="button" class="btn tiny" data-act="tstop">Выйти</button></p>`
}

function writeView(): string {
  return seg([['stroke', 'Черты'], ['type', 'Писать']], ui.writeMode, 'wmode') + (ui.writeMode === 'stroke' ? strokeView() : typeView())
}

function progView(): string {
  const day = today()
  const learned = state.words.filter(word => statusOf(getP(state, word.id).b) === 'done').length
  const bars = []
  let max = 1
  for (let i = 13; i >= 0; i--) {
    const value = state.days[String(day - i)] || 0
    max = Math.max(max, value)
    bars.push(value)
  }
  const chart = `<div class="chart">${bars.map(value => `<i style="height:${Math.max(4, Math.round(value / max * 72))}px"></i>`).join('')}</div>`
  const levelCards = HSK.map(level => {
    const words = state.words.filter(word => word.level === level)
    if (!words.length) return `<section class="card thin"><b>Уровень ${level}</b><p class="muted">Пока нет слов. Новое слово можно сохранить на этот уровень.</p></section>`
    const done = words.filter(word => statusOf(getP(state, word.id).b) === 'done').length
    const learn = words.filter(word => statusOf(getP(state, word.id).b) === 'learn').length
    return `<section class="card thin"><b>Уровень ${level}</b><div class="bar"><i style="width:${done / words.length * 100}%"></i><i class="soft" style="width:${learn / words.length * 100}%"></i></div><p class="muted">${done} выучено · ${learn} в работе · ${words.length - done - learn} новых</p></section>`
  }).join('')
  const cards = state.topics.map(topic => {
    const words = state.words.filter(word => inTopic(state, word, topic.id))
    if (!words.length) return ''
    const done = words.filter(word => statusOf(getP(state, word.id).b) === 'done').length
    const learn = words.filter(word => statusOf(getP(state, word.id).b) === 'learn').length
    return `<section class="card thin"><b>${esc(topic.name)}</b><div class="bar"><i style="width:${done / words.length * 100}%"></i><i class="soft" style="width:${learn / words.length * 100}%"></i></div><p class="muted">${done} выучено · ${learn} в работе · ${words.length - done - learn} новых</p></section>`
  }).join('')
  const badges = `<section class="card"><h2>Достижения</h2><div class="ach">${ACH.map(item => {
    const on = !!state.ach[item.id]
    return `<article class="${on ? '' : 'off'}"><b>${esc(item.title)}${on ? ' ✓' : ''}</b><span class="muted">${esc(item.text)}</span></article>`
  }).join('')}</div></section>`
  const run = streak(state)
  const todayCount = state.days[String(day)] || 0
  return `<section class="card"><div class="stats"><div><b>${run}</b><span>${ruNoun(run, 'день подряд', 'дня подряд', 'дней подряд')}</span></div><div><b>${todayCount}</b><span>${ruNoun(todayCount, 'ответ сегодня', 'ответа сегодня', 'ответов сегодня')}</span></div><div><b>${learned}</b><span>выучено</span></div></div><p class="field">14 дней</p>${chart}</section>${badges}<h2 class="band">По уровню</h2>${levelCards}<h2 class="band">По спискам</h2>${cards}`
}

function settingsView(): string {
  const set = state.settings
  return `<section class="card"><div class="rowtop"><h2>Настройки</h2><button type="button" class="btn tiny" data-act="home">Закрыть</button></div><p class="field">Озвучка</p>${seg([['auto', 'Авто'], ['dict', 'Словарь'], ['system', 'zh-CN']], set.voice, 'voice')}<p class="muted">Авто: голос Xiaoxiao через этот сервер, затем запись Youdao, затем голос zh-CN устройства.</p><p class="field">Скорость</p>${seg(RATES.map(rate => [String(rate), `${String(rate).replace('.', ',')}×`]), String(set.rate), 'rate')}<p class="field">Тема</p>${seg([['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная'], ['jade', 'Нефрит'], ['paper', 'Бумага'], ['ink', 'Тушь']], set.theme, 'theme')}<p class="field">Цвета тонов</p>${seg([['0', 'Выкл'], ['1', 'Пиньинь'], ['2', 'Пиньинь и знаки']], String(set.tc), 'tc')}<p class="muted">1-й тон синий, 2-й зелёный, 3-й оранжевый, 4-й фиолетовый.</p><label class="check"><input type="checkbox" data-act="flag" data-k="pyFront"${set.pyFront ? ' checked' : ''}> Пиньинь сразу на лицевой стороне</label><label class="check"><input type="checkbox" data-act="flag" data-k="strict"${set.strict ? ' checked' : ''}> Строго проверять тоны</label><p class="field">Новых слов в день</p>${seg([['10', '10'], ['20', '20'], ['30', '30'], ['50', '50'], ['999', 'Без лимита']], String(set.perDay), 'perday')}<p class="field">Цель на день</p>${seg([['0', 'Нет'], ['10', '10'], ['20', '20'], ['30', '30'], ['50', '50']], String(set.goal || 0), 'goal')}</section><section class="card"><h2>Перенос</h2><p class="muted">Файл хранит ваши слова, темы и прогресс. Его можно открыть на другом устройстве.</p><div class="acts"><button type="button" class="btn" data-act="exp">Скачать JSON</button><label class="btn">Загрузить<input id="imp" type="file" accept="application/json,.json" hidden></label></div>${ui.confirmReset ? '<div class="confirm"><span>Стереть прогресс, свои слова и настройки?</span><button type="button" class="btn danger" data-act="reset-yes">Да, стереть</button><button type="button" class="btn" data-act="reset-no">Отмена</button></div>' : '<button type="button" class="btn danger tiny" data-act="reset-ask">Сбросить всё</button>'}</section>`
}

export function renderApp(): string {
  const main = ui.view === 'study' ? studyView()
    : ui.view === 'quiz' ? quizView()
    : ui.view === 'gram' ? gramView()
    : ui.view === 'list' ? listView()
    : ui.view === 'edit' ? editView()
    : ui.view === 'write' ? writeView()
    : ui.view === 'prog' ? progView()
    : settingsView()
  return `<div class="app"><header class="top"><div class="brand"><button type="button" class="logo" data-act="home" aria-label="На главный экран"><b>字</b><span><strong>Свои слова</strong><small>иероглифы, чтение, произношение</small></span></button><button type="button" class="icon" data-act="settings" aria-label="Настройки">⚙</button></div>${topicBar()}<nav class="nav" aria-label="Разделы">${TABS.map(([id, label]) => `<button type="button" data-act="tab" data-v="${id}" aria-pressed="${ui.view === id}">${label}</button>`).join('')}</nav></header><main>${main}</main></div>`
}

export function editorFromWord(word: Word): Editor {
  const editor = blankEditor(word.topic)
  editor.id = word.id
  editor.hanzi = word.hanzi
  editor.pinyin = word.pinyin
  editor.auto = false
  editor.ru = word.ru
  editor.pos = word.pos
  editor.note = word.note
  editor.example = word.example
  editor.examplePy = word.examplePy
  editor.exampleAuto = false
  editor.exampleRu = word.exampleRu
  editor.level = word.level || 1
  return editor
}
