import type { AiDraft } from '../../lib/aiClient'

export interface CatalogEntry { type: 'service' | 'inventory'; id: string; name: string; price: number; stock?: number }
export interface DraftLine {
  key: string
  name: string
  quantity: number
  unit_price: number
  matchId: string | null // 'service:ID' | 'inventory:ID' | null = কাস্টম
  priceGiven: boolean
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.,()]/g, '')

/** দুই নামের মিল: ০–১ (একটা অন্যটার ভেতরে থাকলে উঁচু; নাহলে অক্ষর-দ্বিগ্রামের মিল) */
export function similarity(a: string, b: string): number {
  const x = norm(a), y = norm(b)
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) / Math.max(x.length, y.length) < 0.35 ? 0.6 : 0.85
  const bg = (s: string) => { const m = new Set<string>(); for (let i = 0; i < s.length - 1; i++) m.add(s.slice(i, i + 2)); return m }
  const A = bg(x), B = bg(y)
  if (A.size === 0 || B.size === 0) return 0
  let hit = 0
  A.forEach((g) => { if (B.has(g)) hit++ })
  return (2 * hit) / (A.size + B.size)
}

export function bestMatches(name: string, catalog: CatalogEntry[], n = 4): { entry: CatalogEntry; score: number }[] {
  return catalog.map((entry) => ({ entry, score: similarity(name, entry.name) })).filter((m) => m.score >= 0.45).sort((a, b) => b.score - a.score).slice(0, n)
}

const AUTO_MATCH = 0.7

/** AI-র খসড়া আইটেম → কার্টের লাইন। দাম বলা থাকলে সেটাই (মোট হলে ÷ পরিমাণ); না থাকলে ক্যাটালগের দাম। */
export function buildLines(draft: AiDraft, catalog: CatalogEntry[]): DraftLine[] {
  return draft.items.map((it, i) => {
    const top = bestMatches(it.name, catalog, 1)[0]
    const matched = top && top.score >= AUTO_MATCH ? top.entry : null
    let unit = matched ? matched.price : 0
    let given = false
    if (it.price !== null) {
      given = true
      unit = it.price_kind === 'total' ? Math.round((it.price / it.quantity) * 100) / 100 : it.price
    }
    return { key: `d${i}`, name: matched ? matched.name : it.name, quantity: it.quantity, unit_price: unit, matchId: matched ? `${matched.type}:${matched.id}` : null, priceGiven: given }
  })
}
