export const HAN = /\p{Script=Han}/u

export function hanChars(text: string): string[] {
  return [...text].filter(ch => HAN.test(ch))
}

export function esc(text: string): string {
  return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch)
}

export function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function exampleFits(hanzi: string, example: string): boolean {
  const word = hanzi.replace(/[^\p{Script=Han}]/gu, '')
  const sample = example.replace(/[^\p{Script=Han}]/gu, '')
  if (!word || !sample) return false
  return sample.includes(word)
}

export function studyExample(hanzi: string, example: string): boolean {
  if (!exampleFits(hanzi, example)) return false
  if (/[。！？!?；;]/.test(example)) return true
  const word = hanzi.replace(/[^\p{Script=Han}]/gu, '')
  const sample = example.replace(/[^\p{Script=Han}]/gu, '')
  return sample.length >= word.length + 4
}

export function cleanGloss(text: string): string {
  const cleaned = text
    .replace(/\s*[（(][^）)]*[）)]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
  return cleaned || text.trim()
}

export function ruNoun(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count) % 100
  const mod = abs % 10
  if (abs > 10 && abs < 20) return many
  if (mod === 1) return one
  if (mod >= 2 && mod <= 4) return few
  return many
}

export function clozeText(example: string, hanzi: string): string {
  const at = example.indexOf(hanzi)
  if (at < 0) return example
  return `${example.slice(0, at)}____${example.slice(at + hanzi.length)}`
}
