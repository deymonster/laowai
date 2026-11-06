const COOL_MS = 45_000
let coolingUntil = 0

export function edgeRate(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0.9) return '-25%'
  if (rate >= 1.4) return '+50%'
  if (rate >= 1.1) return '+25%'
  return '+0%'
}

export function edgeCooling(now = Date.now()): boolean {
  return now < coolingUntil
}

export function noteEdgeFailure(now = Date.now()) {
  coolingUntil = now + COOL_MS
}

export function noteEdgeSuccess() {
  coolingUntil = 0
}

export function assertEdgeOpen(now = Date.now()) {
  if (edgeCooling(now)) throw new Error('cooling')
}
