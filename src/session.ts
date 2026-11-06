import type { DictHit } from './dict'
import type { Reading } from './pinyin'
import type { Sample } from './types'

export type ViewName = 'study' | 'quiz' | 'gram' | 'list' | 'write' | 'prog' | 'edit' | 'set'
export type QuizKind = 'h2r' | 'r2h' | 'h2p' | 'aud' | 'sent' | 'cloze' | 'gram' | 'speed' | 'say'

export type Editor = {
  id: string | null
  hanzi: string
  pinyin: string
  auto: boolean
  picks: Record<number, string>
  surname: boolean
  ru: string
  pos: string
  note: string
  example: string
  examplePy: string
  exampleAuto: boolean
  examplePicks: Record<number, string>
  exampleRu: string
  uses: Sample[]
  topic: string
  level: number
  parts: Reading[]
  exampleParts: Reading[]
  error: string
  warn: string
  loading: boolean
  query: string
  hits: DictHit[]
  lookupMsg: string
  lastHit: string
}

export type StudySess = {
  ids: string[]
  kind: Record<string, 'new' | 'rev'>
  total: number
  n: number
  failed: string[]
  show: boolean
}

export type QuizItem = { id: string; opts: { text: string; ok: boolean }[]; pick: number | null; heard?: string; mark?: 'ok' | 'off' | 'skip'; line?: Sample }
export type QuizSess = { kind: QuizKind; items: QuizItem[]; i: number; ok: number; bad: string[]; until: number }
export type TypeSess = { mode: 'py' | 'hz'; ids: string[]; i: number; ok: number; bad: string[]; res: { r: string; val: string } | null }

export const ui = {
  view: 'study' as ViewName,
  q: '',
  folder: null as string | null,
  showFolders: false,
  focusTopic: null as string | null,
  scrollTopic: null as string | null,
  status: 'all' as 'all' | 'new' | 'learn' | 'done',
  listExtra: 0,
  openId: null as string | null,
  editor: null as Editor | null,
  study: null as StudySess | null,
  quiz: null as QuizSess | null,
  quizKind: 'h2r' as QuizKind,
  gramQ: '',
  gramOpen: 1,
  writeMode: 'stroke' as 'stroke' | 'type',
  writeText: '永',
  writeCi: 0,
  gloss: { char: '', py: '', alts: [] as string[], ru: '', note: '', wordHan: '', wordPy: '', wordRu: '' },
  strokePlay: 'watch' as 'watch' | 'quiz',
  strokeMsg: '',
  strokeSlow: false,
  strokeAt: 0,
  strokeTotal: 0,
  typeMode: 'py' as 'py' | 'hz',
  type: null as TypeSess | null,
  confirmReset: false,
  dropTopic: null as string | null,
  hear: null as null | { text: string },
  hearNote: '',
}

export function blankEditor(topic: string): Editor {
  return {
    id: null, hanzi: '', pinyin: '', auto: true, picks: {}, surname: false, ru: '', pos: '', note: '',
    example: '', examplePy: '', exampleAuto: true, examplePicks: {}, exampleRu: '', uses: [], topic, level: 1,
    parts: [], exampleParts: [], error: '', warn: '', loading: false,
    query: '', hits: [], lookupMsg: '', lastHit: '',
  }
}
