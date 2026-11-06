import type { DictHit } from '../src/dict'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const TONE: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a', ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v', Ü: 'v',
}

export type DictQuery = { kind: 'han' | 'ru' | 'py'; q: string }

let ca = ''
const cache = new Map<string, { at: number; items: DictHit[] }>()

export function dictionaryQuery(raw: string): DictQuery | null {
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (!text) return null
  if (/\p{Script=Han}/u.test(text)) {
    const q = [...text].filter(ch => /\p{Script=Han}/u.test(ch)).join('').slice(0, 16)
    return q ? { kind: 'han', q } : null
  }
  if (/\p{Script=Cyrillic}/u.test(text)) {
    const q = text.replace(/[^\p{Script=Cyrillic}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    return q ? { kind: 'ru', q } : null
  }
  const q = [...text.normalize('NFC')].map(ch => TONE[ch] || ch).join('')
    .replace(/u:/gi, 'v')
    .replace(/([a-z])[1-5]/gi, '$1 ')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (q.replace(/\s/g, '').length < 2) return null
  return { kind: 'py', q }
}

function decode(text: string): string {
  return text
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
}

function stripTags(html: string): string {
  return decode(html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function isDivOpen(html: string, index: number): boolean {
  return /^<div(\s|>|\/)/i.test(html.slice(index, index + 8))
}

function sliceBalanced(html: string, start: number): string {
  let depth = 1
  let i = start
  while (i < html.length && depth > 0) {
    const nextOpen = html.toLowerCase().indexOf('<div', i)
    const nextClose = html.toLowerCase().indexOf('</div>', i)
    if (nextClose < 0) return html.slice(start)
    if (nextOpen >= 0 && nextOpen < nextClose && isDivOpen(html, nextOpen)) {
      depth++
      i = nextOpen + 4
    } else {
      depth--
      if (depth === 0) return html.slice(start, nextClose)
      i = nextClose + 6
    }
  }
  return html.slice(start)
}

function divBy(html: string, attr: 'id' | 'class', value: string): string {
  const re = /<div\b([^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const attrs = match[1]
    if (attr === 'id') {
      const id = attrs.match(/\bid=(['"])(.*?)\1/i)
      if (!id || id[2] !== value) continue
    } else {
      const cls = attrs.match(/\bclass=(['"])(.*?)\1/i)
      if (!cls || !cls[2].split(/\s+/).includes(value)) continue
    }
    return sliceBalanced(html, match.index + match[0].length)
  }
  return ''
}

function topBlocks(inner: string): { attrs: string; inner: string }[] {
  const blocks: { attrs: string; inner: string }[] = []
  let i = 0
  while (i < inner.length) {
    const open = inner.toLowerCase().indexOf('<div', i)
    if (open < 0) break
    if (!isDivOpen(inner, open)) { i = open + 4; continue }
    const gt = inner.indexOf('>', open)
    if (gt < 0) break
    const content = sliceBalanced(inner, gt + 1)
    blocks.push({ attrs: inner.slice(open + 4, gt), inner: content })
    i = gt + 1 + content.length
    if (inner.slice(i, i + 6).toLowerCase() === '</div>') i += 6
    else break
  }
  return blocks
}

function topDivs(inner: string): string[] {
  return topBlocks(inner).map(block => block.inner)
}

function classNames(attrs: string): string[] {
  const found = attrs.match(/\bclass=(['"])(.*?)\1/i)
  return found ? found[2].split(/\s+/) : []
}

function directText(inner: string): string {
  let out = ''
  let i = 0
  while (i < inner.length) {
    const open = inner.toLowerCase().indexOf('<div', i)
    if (open < 0) { out += inner.slice(i); break }
    if (!isDivOpen(inner, open)) { out += inner.slice(i, open + 4); i = open + 4; continue }
    out += inner.slice(i, open)
    const gt = inner.indexOf('>', open)
    if (gt < 0) break
    const content = sliceBalanced(inner, gt + 1)
    i = gt + 1 + content.length
    if (inner.slice(i, i + 6).toLowerCase() === '</div>') i += 6
  }
  return stripTags(out)
}

function splitExample(text: string): { example: string; exampleRu: string } {
  const clean = text.replace(/\[[^\]]*\]/g, ' ').replace(/\.{2,}/g, ' ').replace(/\s+/g, ' ').trim()
  const han = clean.match(/\p{Script=Han}[\p{Script=Han}0-9，。！？、：；\s]*/u)
  const example = (han?.[0] || '').trim().slice(0, 180)
  const ru = clean
    .replace(/\p{Script=Han}+/gu, ' ')
    .replace(/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ:'’-]+/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const exampleRu = /\p{Script=Cyrillic}/u.test(ru) ? ru.replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '').slice(0, 180) : ''
  return { example, exampleRu }
}

function wordHan(text: string): string {
  return text.replace(/[^\p{Script=Han}]/gu, '')
}

function exampleFits(hanzi: string, example: string): boolean {
  const word = wordHan(hanzi)
  const sample = wordHan(example)
  return !!word && !!sample && sample.includes(word)
}

function examplesIn(html: string): { example: string; exampleRu: string }[] {
  const re = /<div\b[^>]*\bclass=(['"])[^'"]*\bex\b[^'"]*\1[^>]*>([\s\S]*?)<\/div>/gi
  const out: { example: string; exampleRu: string }[] = []
  for (const match of html.matchAll(re)) {
    const item = splitExample(stripTags(match[2]))
    if (item.example) out.push(item)
  }
  return out
}

function giveExample(pending: DictHit[], html: string) {
  for (const item of examplesIn(html)) {
    const owner = pending
      .filter(hit => !hit.example && exampleFits(hit.hanzi, item.example))
      .sort((a, b) => wordHan(b.hanzi).length - wordHan(a.hanzi).length)[0]
    if (!owner) continue
    owner.example = item.example
    owner.exampleRu = item.exampleRu
  }
}

function withoutExamples(html: string): string {
  return html.replace(/<div\b[^>]*\bclass=(['"])[^'"]*\bex\b[^'"]*\1[^>]*>[\s\S]*?<\/div>/gi, ' ')
}

const PAIR = /([\p{Script=Han}]{1,16})\s*([A-Za-z\u00FCv:āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ]+)?/gu

function hanziPairs(text: string): { hanzi: string; pinyin: string }[] {
  const out: { hanzi: string; pinyin: string }[] = []
  for (const match of text.matchAll(PAIR)) {
    let pinyin = match[2] || ''
    if (pinyin && !/[aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(pinyin)) pinyin = ''
    out.push({ hanzi: match[1], pinyin })
  }
  return out
}

function blank(hanzi: string, pinyin: string, ru: string, example = '', exampleRu = ''): DictHit {
  return {
    hanzi, pinyin: pinyin.slice(0, 80), ru: ru.slice(0, 160),
    example: example === hanzi ? '' : example,
    exampleRu: example === hanzi ? '' : exampleRu,
  }
}

function dedupe(items: DictHit[]): DictHit[] {
  const seen = new Set<string>()
  const out: DictHit[] = []
  for (const item of items) {
    const hanzi = item.hanzi.replace(/\s+/g, '')
    const key = `${hanzi}\n${item.ru}\n${item.pinyin}`
    if (!hanzi || !item.ru || seen.has(key)) continue
    seen.add(key)
    out.push({ ...item, hanzi })
    if (out.length >= 8) break
  }
  return out
}

function parsePinyin(html: string): DictHit[] {
  const start = html.search(/id=(['"])py_table\1/i)
  if (start < 0) return []
  const slice = html.slice(start, start + 30000)
  const re = /<td class=(['"])py_ch[^'"]*\1>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/td>\s*<td class=(['"])py_py\3>([\s\S]*?)<\/td>\s*<td class=(['"])py_ru\5>([\s\S]*?)<\/td>/gi
  const items: DictHit[] = []
  for (const match of slice.matchAll(re)) {
    const hanzi = stripTags(match[2])
    if (!/\p{Script=Han}/u.test(hanzi)) continue
    items.push(blank(hanzi, stripTags(match[4]), shortGloss(stripTags(match[6]))))
  }
  return dedupe(items)
}

function parseRussian(html: string, query: string): DictHit[] {
  const inner = divBy(html, 'class', 'ch_ru')
  if (!inner) return []
  const ru = query.replace(/\s+/g, ' ').trim().slice(0, 80)
  const items: DictHit[] = []
  let pending: DictHit[] = []
  for (const block of topDivs(inner)) {
    const pairs = hanziPairs(stripTags(withoutExamples(block)))
    if (pairs.length) {
      pending = pairs.map(pair => blank(pair.hanzi, pair.pinyin, ru))
      giveExample(pending, block)
      items.push(...pending)
    } else giveExample(pending, block)
  }
  return dedupe(items)
}

function shortGloss(text: string): string {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/[;；]|\s2\)/)[0]
    .replace(/^\s*\d+\)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

const POS_WORD = /^(?:сущ(?:ествительное)?|гл(?:агол)?|прил(?:агательное)?|нареч(?:ие)?|частиц[аы]|союз|местоим(?:ение)?|числ(?:ительное)?|сч[её]тн(?:ое)?|межд(?:ометие)?|предлог|вводн(?:ое)?|фон|астр|уст|сокр|вежл|прост|диал|разг|публ|конф)\.?$/iu

function cleanGloss(text: string): string {
  let gloss = shortGloss(text)
    .replace(/^[IVX]{1,4}\b\s*/i, '')
    .replace(/^(?:[A-Za-z\u00FCv:āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ]+[1-5]?(?:\s*,\s*|\s+))*?(?=\p{Script=Cyrillic})/u, '')
  const pos = /^(?:сч[её]тное слово|существительное|прилагательное|числительное|местоимение|междометие|наречие|частицы|частица|предлог|вводное|сущ|гл|прил|нареч|союз|местоим|числ|межд|фон|астр|уст|сокр|вежл|прост|диал|разг|публ|конф)(?!\p{Script=Cyrillic})\.?/iu
  for (let i = 0; i < 6; i++) {
    if (!pos.test(gloss)) break
    gloss = gloss.replace(pos, '').replace(/^[\s,;:./|-]+/, '')
  }
  gloss = gloss.trim()
  const words = gloss.split(/[^\p{Script=Cyrillic}]+/u).filter(word => word.length >= 2 && !POS_WORD.test(word))
  return words.length ? gloss.slice(0, 160) : ''
}

function headerPinyin(inner: string): string {
  const tokens = stripTags(inner).match(/[A-Za-z\u00FCv:āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ]+/g) || []
  return tokens.filter(token => !/^[ivx]+$/i.test(token) && /[aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(token)).join(' ').slice(0, 40)
}

function primaryPy(text: string): string {
  return text.split(/[;,]/)[0]?.trim().slice(0, 40) || ''
}

function rememberExample(hit: DictHit | null, html: string) {
  if (!hit || hit.example) return
  giveExample([hit], html)
}

function parseChinese(html: string): DictHit[] {
  const hanzi = stripTags(divBy(html, 'id', 'ch')).replace(/\s+/g, '')
  if (!/^\p{Script=Han}+$/u.test(hanzi)) return []
  const ruBlock = divBy(html, 'class', 'ru')
  if (!ruBlock) return []
  const pagePy = primaryPy(stripTags(divBy(html, 'class', 'py')))
  const blocks = topBlocks(ruBlock)
  if (!blocks.length) {
    const gloss = cleanGloss(ruBlock)
    if (!gloss) return []
    const hit = blank(hanzi, pagePy, gloss)
    giveExample([hit], ruBlock)
    return dedupe([hit])
  }
  const items: DictHit[] = []
  let py = ''
  let current: DictHit | null = null
  const push = () => {
    if (current?.ru) items.push(current)
    current = null
  }
  const lead = cleanGloss(ruBlock.slice(0, ruBlock.toLowerCase().indexOf('<div')))
  if (lead) current = blank(hanzi, pagePy, lead)
  for (const block of blocks) {
    const names = classNames(block.attrs)
    const structural = names.includes('m2') || names.includes('m3') || names.includes('ex')
    if (names.includes('ex')) {
      rememberExample(current, `<div class="ex">${block.inner}</div>`)
      continue
    }
    if (names.includes('m3')) {
      rememberExample(current, block.inner)
      continue
    }
    const gloss = cleanGloss(directText(block.inner))
    if (!gloss) {
      const label = structural ? '' : headerPinyin(block.inner)
      if (label && current?.ru) {
        push()
        py = label
      } else if (label) py = label
      rememberExample(current, block.inner)
      continue
    }
    if (!current) current = blank(hanzi, py || pagePy, '')
    if (!current.ru) {
      current.ru = gloss
      if (py) current.pinyin = py
    }
    rememberExample(current, block.inner)
  }
  push()
  return dedupe(items)
}

export function parseBkrs(html: string, query: string): DictHit[] {
  const safe = html.replace(/ip:\s*'[^']*'/g, "ip:''")
  if (/id=(['"])py_table\1/i.test(safe)) return parsePinyin(safe)
  if (/class=(['"])[^'"]*\bch_ru\b[^'"]*\1/i.test(safe)) return parseRussian(safe, query)
  return parseChinese(safe)
}

function tokenFrom(html: string, cookies: string[]): string {
  const cookie = html.match(/document\.cookie\s*=\s*["']ca=([0-9a-f]+)/i)
  if (cookie) return cookie[1]
  const named = html.match(/name=(['"])ca\1[^>]*value=(['"])([^'"]+)\2/i)
  if (named) return named[3]
  const valued = html.match(/value=(['"])([^'"]+)\1[^>]*name=(['"])ca\3/i)
  if (valued) return valued[2]
  for (const item of cookies) {
    const match = item.match(/(?:^|;\s*)ca=([^;]+)/)
    if (match) return match[1]
  }
  return ''
}

function cookieList(headers: Headers): string[] {
  const bag = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof bag.getSetCookie === 'function') return bag.getSetCookie()
  const single = headers.get('set-cookie')
  return single ? [single] : []
}

function challenged(html: string): boolean {
  return /name=(['"])ca\1/i.test(html) || /document\.cookie\s*=\s*["']ca=/i.test(html)
}

async function fetchPage(q: string): Promise<string> {
  const url = 'https://bkrs.info/slovo.php?ch=' + encodeURIComponent(q)
  const headers: Record<string, string> = { 'user-agent': UA, accept: 'text/html', 'accept-language': 'ru' }
  if (ca) headers.cookie = `ca=${ca}`
  let response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) })
  let html = await response.text()
  const token = tokenFrom(html, cookieList(response.headers))
  if (token) ca = token
  if (challenged(html) && ca) {
    headers.cookie = `ca=${ca}`
    response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) })
    html = await response.text()
  }
  if (!response.ok || challenged(html)) throw new Error('bkrs')
  return html
}

export async function lookupBkrs(raw: string): Promise<DictHit[]> {
  const spec = dictionaryQuery(raw)
  if (!spec) return []
  const hit = cache.get(spec.q)
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.items
  const items = parseBkrs(await fetchPage(spec.q), spec.kind === 'ru' ? spec.q : raw)
  cache.set(spec.q, { at: Date.now(), items })
  if (cache.size > 100) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  return items
}
