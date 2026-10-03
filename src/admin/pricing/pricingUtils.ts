export type PriceUnit = 'piece' | 'sqft' | 'page' | 'set'
export interface PriceTier { min_qty: number; rate: number }
export interface PriceRule {
  id: string
  name: string
  category: string | null
  unit: PriceUnit
  rate: number
  min_charge: number
  tiers: PriceTier[]
  note: string | null
  is_active: boolean
  sort_order: number
}
export interface QuoteItemRow {
  id: string
  quote_id: string
  description: string
  detail: string | null
  quantity: number
  unit_price: number
  line_total: number
  sort_order: number
}
export interface QuoteRow {
  id: string
  quote_no: string
  shop_customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  note: string | null
  subtotal: number
  discount: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'sold'
  valid_until: string | null
  sale_id: string | null
  created_at: string
}
/** কোটেশনে যোগ হওয়া একটি লাইন (সেভের আগে) */
export interface DraftLine {
  key: string
  description: string
  detail: string
  quantity: number
  unit_price: number
  rule_id: string | null
}

export const UNIT_LABEL: Record<PriceUnit, string> = { piece: 'পিস', sqft: 'বর্গফুট', page: 'পাতা', set: 'সেট' }
export const STATUS_LABEL: Record<QuoteRow['status'], string> = {
  draft: 'খসড়া', sent: 'পাঠানো হয়েছে', accepted: 'গৃহীত', rejected: 'বাতিল', sold: 'বিক্রি হয়েছে',
}

export const money = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })
const r2 = (n: number) => Math.round(n * 100) / 100

/** পরিমাণ অনুযায়ী প্রযোজ্য রেট: যে ধাপের min_qty ≤ পরিমাণ এবং সবচেয়ে বড় */
export function effectiveRate(rule: PriceRule, qty: number): number {
  const tier = [...(rule.tiers || [])]
    .filter((t) => Number(t.min_qty) <= qty && Number(t.rate) >= 0)
    .sort((a, b) => Number(b.min_qty) - Number(a.min_qty))[0]
  return tier ? Number(tier.rate) : Number(rule.rate)
}

export interface CalcInput { qty: number; width?: number; height?: number }
export interface CalcResult { description: string; detail: string; quantity: number; unit_price: number; line_total: number; note?: string }

/**
 * বর্গফুট: প্রতি কপির দাম = মাপ × রেট (রেটের ধাপ মোট ক্ষেত্রফল ধরে), কপি-প্রতি ন্যূনতম চার্জসহ; পরিমাণ = কপি।
 * অন্য একক: পরিমাণ × রেট; মোট ন্যূনতম চার্জের কম হলে ন্যূনতম চার্জই ধরা হয় (পরিমাণ ১, বিবরণে লেখা থাকে)।
 */
export function calcLine(rule: PriceRule, input: CalcInput): CalcResult | null {
  const qty = Number(input.qty)
  if (!qty || qty <= 0) return null
  if (rule.unit === 'sqft') {
    const w = Number(input.width), h = Number(input.height)
    if (!w || !h || w <= 0 || h <= 0) return null
    const area = w * h
    const rate = effectiveRate(rule, area * qty)
    const per = Math.max(r2(area * rate), Number(rule.min_charge))
    const minApplied = per > r2(area * rate)
    return {
      description: rule.name,
      detail: `${w}×${h} ফুট (${r2(area)} বর্গফুট)${minApplied ? ' — ন্যূনতম চার্জ' : ''}`,
      quantity: qty,
      unit_price: r2(per),
      line_total: r2(per * qty),
    }
  }
  const rate = effectiveRate(rule, qty)
  const raw = r2(qty * rate)
  if (raw < Number(rule.min_charge)) {
    return {
      description: rule.name,
      detail: `${qty} ${UNIT_LABEL[rule.unit]} — ন্যূনতম চার্জ`,
      quantity: 1,
      unit_price: r2(Number(rule.min_charge)),
      line_total: r2(Number(rule.min_charge)),
      note: 'ন্যূনতম চার্জ প্রযোজ্য',
    }
  }
  return { description: rule.name, detail: `${qty} ${UNIT_LABEL[rule.unit]} × ${money(rate)}`, quantity: qty, unit_price: r2(rate), line_total: raw }
}
