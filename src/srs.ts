import { hanChars } from './han'
import type { State, Word } from './types'

export const INT = [0, 1, 3, 7, 14, 30, 60]
export type Grade = 'again' | 'hard' | 'good' | 'easy'

export function planGrade(box: number, grade: Grade): { b: number; wait: number } {
  const current = Math.max(0, Math.min(6, box || 0))
  if (grade === 'again') return { b: 1, wait: 0 }
  if (grade === 'hard') {
    if (current <= 1) return { b: 1, wait: current === 0 ? 0 : 1 }
    return { b: current, wait: INT[current - 1] }
  }
  const next = Math.min(6, Math.max(1, current + (grade === 'easy' ? 2 : 1)))
  return { b: next, wait: INT[next] }
}

export function today(): number {
  const date = new Date()
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000)
}

export function getP(state: State, id: string): { b: number; d: number } {
  return state.prog[id] || { b: 0, d: 0 }
}

export function statusOf(box: number): 'new' | 'learn' | 'done' {
  if (box <= 0) return 'new'
  if (box >= 5) return 'done'
  return 'learn'
}

export function inTopic(state: State, word: Word, topicId: string): boolean {
  if (topicId === 'my') return word.topic === 'my' || state.my.includes(word.id)
  return word.topic === topicId
}

export function selectedWords(state: State): Word[] {
  const topics = state.lv.length ? state.lv : ['greet']
  const levels = state.hsk.length ? state.hsk : [1, 2, 3, 4, 5, 6]
  const seen = new Set<string>()
  const out: Word[] = []
  for (const word of state.words) {
    if (seen.has(word.id)) continue
    if (!levels.includes(word.level || 1)) continue
    if (topics.some(id => inTopic(state, word, id))) {
      seen.add(word.id)
      out.push(word)
    }
  }
  return out
}

export function topicCount(state: State, topicId: string): number {
  return state.words.filter(word => inTopic(state, word, topicId)).length
}

function markNew(state: State, day: number) {
  state.nd = state.nd[0] === day ? [day, state.nd[1] + 1] : [day, 1]
}

function bump(state: State, day: number) {
  state.days[String(day)] = (state.days[String(day)] || 0) + 1
}

export function applyGrade(state: State, id: string, grade: Grade) {
  const day = today()
  const prog = getP(state, id)
  if (prog.b === 0) markNew(state, day)
  const next = planGrade(prog.b, grade)
  state.prog[id] = { b: next.b, d: day + next.wait }
  bump(state, day)
}

export function applyResult(state: State, id: string, ok: boolean) {
  const day = today()
  const prog = getP(state, id)
  if (prog.b === 0) markNew(state, day)
  if (ok) {
    if (prog.b === 0) state.prog[id] = { b: 1, d: day + 1 }
    else if (prog.d <= day) {
      const box = Math.min(6, prog.b + 1)
      state.prog[id] = { b: box, d: day + INT[box] }
    }
  } else state.prog[id] = { b: 1, d: day }
  bump(state, day)
}

export type Queue = { ids: string[]; kind: Record<string, 'new' | 'rev'>; due: number; fresh: number; allow: number }

export function buildQueue(state: State, extra?: number): Queue {
  const day = today()
  const due: Word[] = []
  const fresh: Word[] = []
  for (const word of selectedWords(state)) {
    const prog = getP(state, word.id)
    if (prog.b > 0 && prog.d <= day) due.push(word)
    else if (prog.b === 0) fresh.push(word)
  }
  due.sort((a, b) => getP(state, a.id).d - getP(state, b.id).d)
  const used = state.nd[0] === day ? state.nd[1] : 0
  const allow = extra != null ? extra : Math.max(0, (state.settings.perDay || 20) - used)
  const newer = shuffle(fresh).slice(0, allow)
  const kind: Record<string, 'new' | 'rev'> = {}
  const ids: string[] = []
  for (const word of due) { ids.push(word.id); kind[word.id] = 'rev' }
  for (const word of newer) { ids.push(word.id); kind[word.id] = 'new' }
  return { ids, kind, due: due.length, fresh: fresh.length, allow: newer.length }
}

export function shuffle<T>(list: T[]): T[] {
  const copy = list.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function streak(state: State): number {
  let day = today()
  if (!state.days[String(day)]) day -= 1
  let count = 0
  while (state.days[String(day)] > 0) { count++; day-- }
  return count
}

export function dueLabel(dayOffset: number): string {
  if (dayOffset <= 0) return 'сегодня'
  if (dayOffset === 1) return 'завтра'
  return `через ${dayOffset} дн.`
}

export function nextDue(state: State, id: string, grade: Grade): number {
  return planGrade(getP(state, id).b, grade).wait
}

export function findWord(state: State, id: string): Word | undefined {
  return state.words.find(word => word.id === id)
}

export function hanCount(text: string): number {
  return hanChars(text).length
}
