import type { Card, Prog, Side, State, Word } from './types'
import { hanChars } from './han'

export const INT = [0, 1, 3, 7, 14, 30, 60]
export type Grade = 'again' | 'hard' | 'good' | 'easy'
export type QueueItem = { id: string; side: Side; due: number }
export type Queue = {
  items: QueueItem[]
  learn: number
  due: number
  fresh: number
  allow: number
  capped: number
  next: QueueItem | null
}

const DAY = 86_400_000
const MIN = 60_000
const EASE_MIN = 1.3
const REVIEW_CAP = 200
const LEARN = [1, 10]
const MATURE = 21

export function freshCard(): Card {
  return { st: 'new', ease: 2.5, due: 0, step: 0, ivl: 0 }
}

export function today(now = Date.now()): number {
  const date = new Date(now)
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000)
}

export function startOfDayIndex(day: number, now = Date.now()): number {
  const date = new Date(now)
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return midnight + (day - today(now)) * DAY
}

function easeOf(value: number): number {
  const ease = Number.isFinite(value) ? value : 2.5
  return Math.max(EASE_MIN, Math.round(ease * 100) / 100)
}

function cardOf(value: unknown): Card | null {
  if (!value || typeof value !== 'object') return null
  const card = value as Partial<Card>
  const ease = card.ease
  const due = card.due
  const step = card.step
  const ivl = card.ivl
  if (card.st !== 'new' && card.st !== 'learn' && card.st !== 'review' && card.st !== 'relearn') return null
  if (ease == null || due == null || step == null || ivl == null) return null
  if (!Number.isFinite(ease) || !Number.isFinite(due) || !Number.isFinite(step) || !Number.isFinite(ivl)) return null
  return { st: card.st, ease: easeOf(ease), due, step: Math.max(0, Math.floor(step)), ivl: Math.max(0, Math.round(ivl)) }
}

function boxOf(ivl: number): number {
  if (ivl >= 60) return 6
  if (ivl >= 30) return 5
  if (ivl >= 14) return 4
  if (ivl >= 7) return 3
  if (ivl >= 3) return 2
  return 1
}

function summarize(h2r: Card, r2h: Card, now: number): Prog {
  const cards = [h2r, r2h]
  if (cards.every(card => card.st === 'new')) return { b: 0, d: 0, h2r, r2h }
  const started = cards.filter(card => card.st !== 'new')
  const ivl = Math.min(...started.map(card => card.st === 'review' ? card.ivl : 0))
  const dues = started.map(card => card.due).filter(due => due > 0)
  return { b: Math.max(1, boxOf(ivl)), d: today(dues.length ? Math.min(...dues) : now), h2r, r2h }
}

export function migrateProg(raw: unknown, now = Date.now()): Prog | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as { b?: number; d?: number; h2r?: unknown; r2h?: unknown }
  let h2r = cardOf(data.h2r)
  let r2h = cardOf(data.r2h)
  if (!h2r && !r2h) {
    const box = Number(data.b)
    const day = Number(data.d)
    if (!(box >= 1 && box <= 6) || !Number.isFinite(day)) return null
    const card: Card = { st: 'review', ease: 2.5, due: startOfDayIndex(day, now), step: 0, ivl: INT[box] }
    h2r = { ...card }
    r2h = { ...card }
  }
  const prog = summarize(h2r || freshCard(), r2h || freshCard(), now)
  return prog.b === 0 ? null : prog
}

export function getP(state: State, id: string): Prog {
  const found = state.prog[id]
  if (found?.h2r && found?.r2h) return found
  return { b: 0, d: 0, h2r: freshCard(), r2h: freshCard() }
}

export function statusOf(prog: Prog): 'new' | 'learn' | 'done' {
  if (prog.h2r.st === 'new' && prog.r2h.st === 'new') return 'new'
  if (prog.h2r.st === 'review' && prog.r2h.st === 'review' && prog.h2r.ivl >= MATURE && prog.r2h.ivl >= MATURE) return 'done'
  return 'learn'
}

function fuzz(days: number, rand: number): number {
  if (days <= 2) return days
  const span = days * 0.05
  return Math.max(1, Math.round(days + (rand - 0.5) * 2 * span))
}

function reviewDays(card: Card, rand: number): { hard: number; good: number; easy: number } {
  const ivl = Math.max(1, card.ivl)
  const hard0 = Math.max(ivl + 1, Math.round(ivl * 1.2))
  const good0 = Math.max(hard0 + 1, Math.round(ivl * card.ease))
  const easy0 = Math.max(good0 + 1, Math.round(ivl * card.ease * 1.3))
  let hard = fuzz(hard0, rand)
  let good = fuzz(good0, rand)
  let easy = fuzz(easy0, rand)
  if (good <= hard) good = hard + 1
  if (easy <= good) easy = good + 1
  return { hard, good, easy }
}

export function nextCard(card: Card, grade: Grade, now: number, rand = 0.5): Card {
  const ease = easeOf(card.ease)
  if (card.st === 'review') {
    const days = reviewDays({ ...card, ease }, rand)
    if (grade === 'again') return { st: 'relearn', ease: easeOf(ease - 0.2), due: now + 10 * MIN, step: 0, ivl: 1 }
    if (grade === 'hard') return { st: 'review', ease: easeOf(ease - 0.15), due: now + days.hard * DAY, step: 0, ivl: days.hard }
    if (grade === 'easy') return { st: 'review', ease: easeOf(ease + 0.15), due: now + days.easy * DAY, step: 0, ivl: days.easy }
    return { st: 'review', ease, due: now + days.good * DAY, step: 0, ivl: days.good }
  }
  const steps = card.st === 'relearn' ? [10] : LEARN
  const step = card.st === 'new' ? 0 : Math.min(Math.max(0, card.step), steps.length - 1)
  if (grade === 'easy') return { st: 'review', ease, due: now + 4 * DAY, step: 0, ivl: 4 }
  if (grade === 'again') {
    const learning = card.st === 'relearn'
    return { st: learning ? 'relearn' : 'learn', ease, due: now + (learning ? 10 : 1) * MIN, step: 0, ivl: learning ? Math.max(1, card.ivl) : 0 }
  }
  if (grade === 'hard') return { st: card.st === 'new' ? 'learn' : card.st, ease, due: now + steps[step] * MIN, step, ivl: card.ivl }
  if (step < steps.length - 1) return { st: 'learn', ease, due: now + steps[step + 1] * MIN, step: step + 1, ivl: 0 }
  const ivl = card.st === 'relearn' ? Math.max(1, card.ivl || 1) : 1
  return { st: 'review', ease, due: now + ivl * DAY, step: 0, ivl }
}

export function gradeDelay(state: State, id: string, side: Side, grade: Grade, now = Date.now()): number {
  return Math.max(0, nextCard(getP(state, id)[side], grade, now, 0.5).due - now)
}

export function intervalLabel(ms: number): string {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))} мин`
  if (ms < DAY) return `${Math.max(1, Math.round(ms / (60 * MIN)))} ч`
  const days = Math.max(1, Math.round(ms / DAY))
  return days === 1 ? 'завтра' : `${days} дн.`
}

function bumpDay(pair: [number, number], day: number): [number, number] {
  return pair[0] === day ? [day, pair[1] + 1] : [day, 1]
}

export function noteDay(state: State, now = Date.now()) {
  const day = today(now)
  state.days[String(day)] = (state.days[String(day)] || 0) + 1
}

export function applyAnswer(state: State, id: string, side: Side, grade: Grade, now = Date.now(), rand = Math.random()): Card {
  const prog = getP(state, id)
  const prev = prog[side]
  const next = nextCard(prev, grade, now, rand)
  const h2r = side === 'h2r' ? next : { ...prog.h2r }
  const r2h = side === 'r2h' ? next : { ...prog.r2h }
  const summary = summarize(h2r, r2h, now)
  if (summary.b === 0) delete state.prog[id]
  else state.prog[id] = summary
  const day = today(now)
  if (prev.st === 'new') state.nd = bumpDay(state.nd || [0, 0], day)
  if (prev.st === 'review') state.rd = bumpDay(state.rd || [0, 0], day)
  noteDay(state, now)
  return next
}

export function orderLeft<T extends { due: number }>(left: T[], now: number): T[] {
  const ready: T[] = []
  const later: T[] = []
  for (const item of left) (item.due === 0 || item.due <= now ? ready : later).push(item)
  later.sort((a, b) => a.due - b.due)
  return ready.concat(later)
}

function sidesOf(state: State): Side[] {
  if (state.settings.dir === 'r2h') return ['r2h']
  if (state.settings.dir === 'h2r') return ['h2r']
  return ['h2r', 'r2h']
}

export function buildQueue(state: State, extra?: number, now = Date.now()): Queue {
  const day = today(now)
  const learning: QueueItem[] = []
  const later: QueueItem[] = []
  const reviews: QueueItem[] = []
  const fresh: QueueItem[] = []
  for (const word of selectedWords(state)) {
    const prog = getP(state, word.id)
    for (const side of sidesOf(state)) {
      const card = prog[side]
      const item = { id: word.id, side, due: card.due }
      if (card.st === 'learn' || card.st === 'relearn') (card.due <= now ? learning : later).push(item)
      else if (card.st === 'review' && card.due <= now) reviews.push(item)
      else if (card.st === 'new') fresh.push({ id: word.id, side, due: 0 })
    }
  }
  learning.sort((a, b) => a.due - b.due)
  later.sort((a, b) => a.due - b.due)
  reviews.sort((a, b) => a.due - b.due)
  const seenReviews = state.rd?.[0] === day ? state.rd[1] : 0
  const reviewAllow = Math.max(0, REVIEW_CAP - seenReviews)
  const reviewSlice = reviews.slice(0, reviewAllow)
  const usedNew = state.nd?.[0] === day ? state.nd[1] : 0
  const allow = extra != null ? extra : Math.max(0, (state.settings.perDay || 20) - usedNew)
  const items = [
    ...learning,
    ...reviewSlice.map(item => ({ ...item, due: 0 })),
    ...shuffle(fresh).slice(0, allow),
  ]
  return {
    items,
    learn: learning.length,
    due: reviewSlice.length,
    fresh: fresh.length,
    allow: items.length - learning.length - reviewSlice.length,
    capped: Math.max(0, reviews.length - reviewSlice.length),
    next: items.length ? null : later[0] || null,
  }
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

export function findWord(state: State, id: string): Word | undefined {
  return state.words.find(word => word.id === id)
}

export function hanCount(text: string): number {
  return hanChars(text).length
}
