export type Sample = { hanzi: string; py: string; ru: string }

export type Word = {
  id: string
  topic: string
  hanzi: string
  pinyin: string
  ru: string
  pos: string
  note: string
  example: string
  examplePy: string
  exampleRu: string
  uses: Sample[]
  level: number
  custom: boolean
}

export type Topic = { id: string; name: string; builtin: boolean }

export type CardState = 'new' | 'learn' | 'review' | 'relearn'
export type Side = 'h2r' | 'r2h'

export type Card = {
  st: CardState
  ease: number
  due: number
  step: number
  ivl: number
}

export type Prog = { b: number; d: number; h2r: Card; r2h: Card }

export type VoiceMode = 'auto' | 'dict' | 'system'

export type Settings = {
  dir: 'h2r' | 'r2h' | 'both'
  pyFront: boolean
  strict: boolean
  rate: number
  voice: VoiceMode
  tc: 0 | 1 | 2
  perDay: number
  goal: number
  theme: 'auto' | 'light' | 'dark' | 'jade' | 'paper' | 'ink'
  sayShow: boolean
}

export type State = {
  v: 1
  words: Word[]
  topics: Topic[]
  prog: Record<string, Prog>
  my: string[]
  days: Record<string, number>
  nd: [number, number]
  rd: [number, number]
  lv: string[]
  hsk: number[]
  settings: Settings
  cor: number
  rec: number
  gram: string[]
  ach: Record<string, number>
}
