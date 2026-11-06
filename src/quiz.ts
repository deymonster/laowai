import { GRAMMAR } from './grammar'
import type { QuizItem, QuizKind, QuizSess } from './session'
import { selectedWords, shuffle } from './srs'
import { state } from './store'
import type { Word } from './types'

export function quizBlurb(kind: QuizKind): string {
  if (kind === 'aud') return 'Слово звучит, нужно выбрать иероглифы. Десять вопросов.'
  if (kind === 'sent') return 'Звучит пример, нужно выбрать перевод. Десять вопросов.'
  if (kind === 'cloze') return 'В примере пропущено слово. Нужно выбрать иероглифы.'
  if (kind === 'gram') return 'Десять правил выбранных уровней HSK. Прогресс слов при этом не меняется.'
  if (kind === 'say') return 'Слушаете пример и повторяете его. Десять фраз только из выбранных списков.'
  if (kind === 'speed') return `Минута на иероглиф и перевод. Ошибка отнимает 3 секунды. Рекорд: ${state.rec}.`
  return 'Десять вопросов. Ответ двигает прогресс слова.'
}

function withExample(list: Word[], cloze: boolean): Word[] {
  return list.filter(word => word.example && word.exampleRu && (!cloze || word.example.includes(word.hanzi)))
}

export function quizWords(kind: QuizKind): Word[] {
  const selected = selectedWords(state)
  if (kind === 'cloze' || kind === 'sent' || kind === 'say') return withExample(selected, kind === 'cloze')
  return selected.length >= 4 ? selected : state.words
}

function grammarNow() {
  const levels = state.hsk.length ? state.hsk : [1, 2, 3, 4, 5, 6]
  const rules = GRAMMAR.filter(rule => levels.includes(rule.level))
  return rules.length >= 4 ? rules : GRAMMAR
}

export function canQuiz(kind: QuizKind): boolean {
  if (kind === 'gram') return grammarNow().length >= 4
  return quizWords(kind).length >= 4
}

function choice(words: Word[], word: Word, text: (item: Word) => string): QuizItem {
  const answer = text(word)
  const distractors = shuffle(words.filter(item => item.id !== word.id && text(item) !== answer)).slice(0, 3)
  while (distractors.length < 3) {
    const extra = words.find(item => item.id !== word.id && !distractors.includes(item))
    if (!extra) break
    distractors.push(extra)
  }
  return {
    id: word.id,
    pick: null,
    opts: shuffle([word, ...distractors].slice(0, 4)).map(item => ({ text: text(item), ok: item.id === word.id })),
  }
}

export function makeQuiz(kind: QuizKind): QuizSess | null {
  if (!canQuiz(kind)) return null
  if (kind === 'gram') {
    const pool = grammarNow()
    const rules = shuffle(pool).slice(0, 10)
    return {
      kind,
      i: 0,
      ok: 0,
      bad: [],
      until: 0,
      items: rules.map(rule => {
        const others = shuffle(pool.filter(item => item.id !== rule.id)).slice(0, 3)
        return {
          id: rule.id,
          pick: null,
          opts: shuffle([rule, ...others]).map(item => ({ text: item.exampleRu, ok: item.id === rule.id })),
        }
      }),
    }
  }
  if (kind === 'say') {
    const words = quizWords(kind)
    const picked: Word[] = []
    while (picked.length < 10) picked.push(...shuffle(words))
    picked.length = 10
    return { kind, i: 0, ok: 0, bad: [], until: 0, items: picked.map(word => ({ id: word.id, pick: null, opts: [] })) }
  }
  const words = quizWords(kind)
  const count = kind === 'speed' ? 40 : 10
  const picked: Word[] = []
  while (picked.length < count) picked.push(...shuffle(words))
  picked.length = count
  const text = (word: Word) => kind === 'h2p' ? word.pinyin
    : kind === 'h2r' || kind === 'speed' ? word.ru
    : kind === 'sent' ? word.exampleRu
    : word.hanzi
  return {
    kind,
    i: 0,
    ok: 0,
    bad: [],
    until: kind === 'speed' ? Date.now() + 60000 : 0,
    items: picked.map(word => choice(words, word, text)),
  }
}


