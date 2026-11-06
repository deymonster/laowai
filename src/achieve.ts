import { GRAMMAR } from './grammar'
import { streak } from './srs'
import type { State } from './types'

export const ACH = [
  { id: 'week', title: 'Семь дней подряд', text: 'Занимайтесь семь дней без пропуска.', test: (state: State) => streak(state) >= 7 },
  { id: 'words', title: 'Двадцать слов в работе', text: 'Начните хотя бы двадцать слов.', test: (state: State) => Object.values(state.prog).filter(item => item.b > 0).length >= 20 },
  { id: 'hits', title: 'Пятьдесят верных ответов', text: 'Наберите пятьдесят верных ответов в учёбе и тестах.', test: (state: State) => state.cor >= 50 },
  { id: 'minute', title: 'Десять за минуту', text: 'В тесте на скорость дайте десять верных ответов.', test: (state: State) => state.rec >= 10 },
  { id: 'rules', title: 'Все правила отмечены', text: 'Отметьте все короткие правила грамматики.', test: (state: State) => GRAMMAR.every(rule => state.gram.includes(rule.id)) },
]

export function unlock(state: State): string[] {
  const fresh: string[] = []
  for (const item of ACH) {
    if (state.ach[item.id] || !item.test(state)) continue
    state.ach[item.id] = Date.now()
    fresh.push(item.title)
  }
  return fresh
}
