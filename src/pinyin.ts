export type Reading = {
  ch: string
  han: boolean
  options: string[]
  value: string
}

export type ReadingResult = { text: string; parts: Reading[] }

type AllItem = {
  origin: string
  result: string
  isZh: boolean
  polyphonic?: string[]
}

const TONE_MARK: Record<string, [string, number]> = {
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['v', 1], ǘ: ['v', 2], ǚ: ['v', 3], ǜ: ['v', 4],
  ü: ['v', 0],
}

const TONE_CHAR: Record<string, string> = {
  a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', v: 'ǖǘǚǜ',
}

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
const FINALS = ['iang', 'iong', 'uang', 'ueng', 'ang', 'eng', 'ing', 'ong', 'iao', 'ian', 'uai', 'uan', 'van', 'ai', 'ei', 'ao', 'ou', 'ia', 'ie', 'iu', 'in', 'ua', 'uo', 'ui', 'un', 'ue', 've', 'er', 'an', 'en', 'vn', 'a', 'o', 'e', 'i', 'u', 'v']

let libPromise: Promise<typeof import('pinyin-pro')> | null = null

function lib() {
  libPromise ??= import('pinyin-pro')
  return libPromise
}

function uniq(list: string[]): string[] {
  const out: string[] = []
  for (const item of list) if (item && !out.includes(item)) out.push(item)
  return out
}

export async function analyze(text: string, surname = false): Promise<ReadingResult> {
  const compact = text.replace(/\s+/g, '')
  if (!compact) return { text: '', parts: [] }
  const { pinyin } = await lib()
  const all = pinyin(compact, {
    type: 'all',
    toneType: 'symbol',
    segmentit: 2,
    mode: surname ? 'surname' : 'normal',
    surname: surname ? 'head' : 'off',
    nonZh: 'consecutive',
    toneSandhi: true,
  }) as AllItem[]
  const parts: Reading[] = all.map(item => {
    const han = !!item.isZh && /\p{Script=Han}/u.test(item.origin)
    const options = han ? uniq([item.result, ...(item.polyphonic || [])]) : []
    return { ch: item.origin, han, options, value: han ? item.result : '' }
  })
  return { text: compose(parts, {}), parts }
}

export function syllableAt(pinyin: string, hanzi: string, index: number): string {
  const count = [...hanzi].filter(ch => /\p{Script=Han}/u.test(ch)).length
  const syllables = pinyin.trim().split(/\s+/).filter(Boolean)
  if (!count || syllables.length !== count || index < 0 || index >= count) return ''
  return syllables[index]
}

export function compose(parts: Reading[], picks: Record<number, string>): string {
  const out: string[] = []
  parts.forEach((part, index) => {
    if (!part.han) return
    const pick = picks[index]
    out.push(pick && part.options.includes(pick) ? pick : part.value)
  })
  return out.join(' ')
}

export function toneOf(syllable: string): number {
  for (const ch of syllable.normalize('NFC')) {
    const mark = TONE_MARK[ch]
    if (mark && mark[1]) return mark[1]
  }
  return 5
}

function applyTone(base: string, tone: number): string {
  const written = base.replace(/u:/g, 'v').replace(/ü/g, 'v').replace(/^([jqxy])v/, '$1u')
  const chars = [...written]
  if (tone < 1 || tone > 4) return chars.join('').replace(/v/g, 'ü')
  let index = chars.findIndex(ch => ch === 'a' || ch === 'e')
  if (index < 0 && chars.join('').includes('ou')) index = chars.join('').indexOf('ou')
  if (index < 0) {
    for (let i = chars.length - 1; i >= 0; i--) {
      if ('aeiouv'.includes(chars[i])) { index = i; break }
    }
  }
  if (index < 0) return chars.join('').replace(/v/g, 'ü')
  const marks = TONE_CHAR[chars[index]]
  if (marks) chars[index] = marks[tone - 1]
  return chars.join('').replace(/v/g, 'ü')
}

function splitSyllables(input: string): string[] {
  let rest = input.toLowerCase().replace(/ü/g, 'v').replace(/[^a-z0-5]/g, '')
  const out: string[] = []
  while (rest) {
    let initial = ''
    for (const item of INITIALS) {
      if (rest.startsWith(item)) { initial = item; break }
    }
    const body = rest.slice(initial.length)
    let final = ''
    for (const item of FINALS) {
      if (body.startsWith(item)) { final = item; break }
    }
    if (!final) {
      out.push(rest[0])
      rest = rest.slice(1)
      continue
    }
    let size = initial.length + final.length
    if (/[1-5]/.test(rest[size] || '')) size += 1
    out.push(rest.slice(0, size))
    rest = rest.slice(size)
  }
  return out
}

function canon(base: string): string {
  return base.toLowerCase().replace(/ü/g, 'v').replace(/^([jqxy])u(?!o)/, '$1v')
}

function parseSyllable(token: string): { base: string; tone: string } {
  const match = token.toLowerCase().replace(/ü/g, 'v').match(/^([a-z]+)([0-5])?$/)
  if (!match) return { base: canon(token.toLowerCase().replace(/[^a-zv]/g, '')), tone: '' }
  const tone = !match[2] || match[2] === '0' || match[2] === '5' ? '' : match[2]
  return { base: canon(match[1]), tone }
}

function syllsInToken(token: string): { base: string; tone: string }[] {
  if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(token)) {
    let letters = ''
    const toneAt = new Map<number, number>()
    for (const ch of token.normalize('NFC')) {
      const mark = TONE_MARK[ch]
      if (mark) {
        if (mark[1]) toneAt.set(letters.length, mark[1])
        letters += mark[0]
      } else if (/[a-z]/i.test(ch)) letters += ch.toLowerCase()
    }
    const parts = splitSyllables(letters)
    let cursor = 0
    return parts.map(part => {
      const start = cursor
      cursor += part.length
      let tone = ''
      for (let i = start; i < cursor; i++) {
        const found = toneAt.get(i)
        if (found) tone = found === 5 ? '' : String(found)
      }
      return { base: canon(part), tone }
    })
  }
  return splitSyllables(token).map(parseSyllable)
}

export function syllables(input: string): { base: string; tone: string }[] {
  const cleaned = input.trim().replace(/u:/gi, 'ü').replace(/[.,!?;:，。！？、；：'"“”‘’()（）]/g, ' ')
  const out: { base: string; tone: string }[] = []
  for (const token of cleaned.split(/\s+/).filter(Boolean)) out.push(...syllsInToken(token))
  return out
}

export type Judge = 'empty' | 'ok' | 'ok-nt' | 'tone' | 'wrong'

export function judge(input: string, expected: string, strict: boolean): Judge {
  if (!input.trim()) return 'empty'
  const got = syllables(input)
  const want = syllables(expected)
  const base = (list: { base: string; tone: string }[]) => list.map(item => item.base).join('')
  const tones = (list: { base: string; tone: string }[]) => list.map(item => item.tone).join('')
  if (!got.length || base(got) !== base(want)) return 'wrong'
  if (tones(got) === tones(want)) return 'ok'
  if (!tones(got)) return strict ? 'tone' : 'ok-nt'
  return 'tone'
}

export function prettifyPinyin(input: string): string {
  const raw = input.trim().replace(/\s+/g, ' ')
  if (!raw) return ''
  if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(raw) && !/[1-5]/.test(raw)) {
    return raw.replace(/u:/gi, 'ü').replace(/\s+/g, ' ')
  }
  return syllables(raw).map(item => applyTone(item.base, Number(item.tone || 0))).join(' ')
}

const PLAIN: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'u', ǘ: 'u', ǚ: 'u', ǜ: 'u',
  ü: 'u', v: 'u',
}

export function searchKey(text: string): string {
  const lower = text.toLowerCase().replace(/ё/g, 'е')
  let out = ''
  for (const ch of lower) out += PLAIN[ch] || ch
  return out.replace(/\s+/g, '')
}

export function pyHTML(pinyin: string, escape: (text: string) => string): string {
  return pinyin.split(/(\s+)/).map(part => {
    if (!part.trim()) return escape(part)
    return `<span class="tn t${toneOf(part)}">${escape(part)}</span>`
  }).join('')
}
