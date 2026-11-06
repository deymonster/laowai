export type DictHit = {
  hanzi: string
  pinyin: string
  ru: string
  example: string
  exampleRu: string
}

export async function lookupWord(q: string): Promise<DictHit[]> {
  const query = q.trim()
  if (!query) return []
  let response: Response
  try {
    response = await fetch('/api/dict?q=' + encodeURIComponent(query))
  } catch {
    throw new Error('Словарь доступен, когда приложение запущено через npm run dev.')
  }
  if (!response.ok) throw new Error('Словарь БКРС сейчас не ответил. Перевод можно вписать вручную.')
  let data: { items?: DictHit[] }
  try {
    data = await response.json() as { items?: DictHit[] }
  } catch {
    throw new Error('Словарь БКРС сейчас не ответил. Перевод можно вписать вручную.')
  }
  if (!Array.isArray(data.items)) return []
  return data.items.filter(item => item && typeof item.hanzi === 'string' && item.hanzi)
}
