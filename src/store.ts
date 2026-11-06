import { exampleFits } from './han'
import { HSK_WORDS } from './hsk-list'
import { SEED, TOPICS } from './seed'
import type { Sample, Settings, State, Topic, Word } from './types'

const KEY = 'zici-v1'

export const RATES = [0.75, 1, 1.25, 1.5]

export function defaultSettings(): Settings {
  return { dir: 'h2r', pyFront: false, strict: false, rate: 1, voice: 'auto', tc: 1, perDay: 20, goal: 0, theme: 'auto', sayShow: true }
}

export function freshState(): State {
  return {
    v: 1,
    words: [...SEED, ...HSK_WORDS].map(word => ({ ...word, uses: word.uses.map(item => ({ ...item })) })),
    topics: TOPICS.map(topic => ({ ...topic })),
    prog: {},
    my: [],
    days: {},
    nd: [0, 0],
    lv: ['greet'],
    hsk: [1, 2, 3, 4, 5, 6],
    settings: defaultSettings(),
    cor: 0,
    rec: 0,
    gram: [],
    ach: {},
  }
}

function isWord(value: unknown): value is Word {
  if (!value || typeof value !== 'object') return false
  const word = value as Word
  return typeof word.id === 'string' && typeof word.hanzi === 'string' && typeof word.pinyin === 'string' && typeof word.ru === 'string' && typeof word.topic === 'string'
}

function copyUses(uses: Sample[] | undefined, hanzi = ''): Sample[] {
  return (uses || [])
    .filter(item => item && item.hanzi && item.ru && (!hanzi || exampleFits(hanzi, item.hanzi)))
    .map(item => ({ hanzi: item.hanzi, py: item.py || '', ru: item.ru }))
}

function mergeSeed(state: State) {
  for (const topic of TOPICS) {
    if (!state.topics.some(item => item.id === topic.id)) state.topics.push({ ...topic })
  }
  for (const word of [...SEED, ...HSK_WORDS]) {
    const found = state.words.find(item => item.id === word.id)
    if (!found) {
      state.words.push({ ...word, uses: copyUses(word.uses) })
      continue
    }
    if (found.custom) continue
    found.note = word.note
    found.example = word.example
    found.examplePy = word.examplePy
    found.exampleRu = word.exampleRu
    found.uses = copyUses(word.uses)
    found.level = word.level
  }
}

function normalize(raw: unknown): State {
  const base = freshState()
  if (!raw || typeof raw !== 'object') return freshState()
  const data = raw as Partial<State>
  if (Array.isArray(data.words)) base.words = data.words.filter(isWord).map(word => ({
    ...word,
    pos: word.pos || '',
    note: word.note || '',
    example: word.example && exampleFits(word.hanzi, word.example) ? word.example : '',
    examplePy: word.example && exampleFits(word.hanzi, word.example) ? word.examplePy || '' : '',
    exampleRu: word.example && exampleFits(word.hanzi, word.example) ? word.exampleRu || '' : '',
    uses: copyUses(word.uses, word.hanzi),
    level: [1, 2, 3, 4, 5, 6].includes(Number(word.level)) ? Number(word.level) : 1,
    custom: !!word.custom,
  }))
  if (Array.isArray(data.topics)) {
    const topics: Topic[] = []
    for (const topic of data.topics) {
      if (topic && typeof topic.id === 'string' && typeof topic.name === 'string') topics.push({ id: topic.id, name: topic.name, builtin: !!topic.builtin })
    }
    if (topics.length) base.topics = topics
  }
  if (data.prog && typeof data.prog === 'object') {
    for (const [id, prog] of Object.entries(data.prog)) {
      if (prog && prog.b >= 1 && prog.b <= 6 && Number.isFinite(prog.d)) base.prog[id] = { b: prog.b, d: prog.d }
    }
  }
  if (Array.isArray(data.my)) base.my = data.my.filter(id => typeof id === 'string').slice(0, 6000)
  if (data.days && typeof data.days === 'object') {
    for (const [day, count] of Object.entries(data.days)) {
      if (/^\d+$/.test(day) && Number(count) > 0) base.days[day] = Number(count)
    }
  }
  if (Array.isArray(data.nd) && data.nd.length === 2) base.nd = [Number(data.nd[0]) || 0, Number(data.nd[1]) || 0]
  if (Array.isArray(data.lv)) {
    const lv = data.lv.filter(id => typeof id === 'string' && base.topics.some(topic => topic.id === id))
    if (lv.length) base.lv = lv
  }
  if (Array.isArray(data.hsk)) {
    const hsk = [...new Set(data.hsk.map(Number).filter(level => [1, 2, 3, 4, 5, 6].includes(level)))]
    if (hsk.length) base.hsk = hsk.sort((a, b) => a - b)
  }
  const settings = data.settings
  if (settings && typeof settings === 'object') {
    if (settings.dir === 'h2r' || settings.dir === 'r2h') base.settings.dir = settings.dir
    if (typeof settings.pyFront === 'boolean') base.settings.pyFront = settings.pyFront
    if (typeof settings.strict === 'boolean') base.settings.strict = settings.strict
    if (typeof settings.sayShow === 'boolean') base.settings.sayShow = settings.sayShow
    if (RATES.includes(Number(settings.rate))) base.settings.rate = Number(settings.rate)
    if (settings.voice === 'auto' || settings.voice === 'dict' || settings.voice === 'system') base.settings.voice = settings.voice
    if (settings.tc === 0 || settings.tc === 1 || settings.tc === 2) base.settings.tc = settings.tc
    if ([10, 20, 30, 50, 999].includes(Number(settings.perDay))) base.settings.perDay = Number(settings.perDay)
    if ([0, 10, 20, 30, 50].includes(Number(settings.goal))) base.settings.goal = Number(settings.goal)
    if (settings.theme === 'auto' || settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'jade' || settings.theme === 'paper' || settings.theme === 'ink') base.settings.theme = settings.theme
  }
  if (typeof data.cor === 'number' && data.cor > 0) base.cor = Math.floor(data.cor)
  if (typeof data.rec === 'number' && data.rec > 0) base.rec = Math.floor(data.rec)
  if (Array.isArray(data.gram)) base.gram = data.gram.filter(id => typeof id === 'string').slice(0, 400)
  if (data.ach && typeof data.ach === 'object') {
    for (const [id, at] of Object.entries(data.ach)) {
      if (typeof id === 'string' && Number(at) > 0) base.ach[id] = Number(at)
    }
  }
  mergeSeed(base)
  return base
}

export let state: State = freshState()

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    state = raw ? normalize(JSON.parse(raw)) : freshState()
  } catch {
    state = freshState()
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode */ }
}

export function replaceState(next: State) {
  state = next
  save()
}

export function adoptRaw(raw: unknown) {
  state = normalize(raw)
  save()
}

export function resetState() {
  state = freshState()
  save()
}
