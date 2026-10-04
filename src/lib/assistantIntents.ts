import { supabase } from './supabase'
import type { AiIntent } from './aiClient'

/**
 * স্মার্ট সহকারীর "ডাটা প্রশ্ন" — AI নিজে SQL চালায় না।
 * প্রশ্ন চিনে নির্দিষ্ট read-only RPC (ai_*) ডাকে; RPC শুধু অ্যাডমিনের জন্য (supabase_phaseH_assistant_migration.sql)।
 */
export type AssistantAnswer = { summary: string; rows?: { title: string; subtitle: string }[] }

type Period = { from: string; to: string; label: string }
type Intent =
  | { kind: 'spend'; name: string; period: Period | null }
  | { kind: 'expense'; period: Period }
  | { kind: 'due' }
  | { kind: 'lowstock' }
  | { kind: 'top'; period: Period }
  | { kind: 'sales'; period: Period }
  | { kind: 'compare'; a: Period; b: Period }

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
const toNum = (s: string) => Number(s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d))))
const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

const shift = (date: string, opts: { days?: number; months?: number }) => {
  const d = new Date(date + 'T00:00:00Z')
  if (opts.months) d.setUTCMonth(d.getUTCMonth() + opts.months)
  if (opts.days) d.setUTCDate(d.getUTCDate() + opts.days)
  return d.toISOString().slice(0, 10)
}

/** প্রশ্ন থেকে সময়কাল বের করা; না পেলে null */
function parsePeriod(q: string): Period | null {
  const t = today()
  const n = q.match(/গত\s*([\d০-৯]+)\s*(মাস|দিন|সপ্তাহ)/)
  if (n) {
    const k = toNum(n[1])
    if (n[2] === 'মাস') return { from: shift(t, { months: -k }), to: t, label: `গত ${k.toLocaleString('bn-BD')} মাসে` }
    if (n[2] === 'দিন') return { from: shift(t, { days: -(k - 1) }), to: t, label: `গত ${k.toLocaleString('bn-BD')} দিনে` }
    return { from: shift(t, { days: -(k * 7 - 1) }), to: t, label: `গত ${k.toLocaleString('bn-BD')} সপ্তাহে` }
  }
  if (/এই\s*সপ্তাহ|সপ্তাহে|week/i.test(q)) return { from: shift(t, { days: -6 }), to: t, label: 'গত ৭ দিনে' }
  if (/এই\s*মাস|মাসে|মাসের|month/i.test(q)) return { from: t.slice(0, 7) + '-01', to: t, label: 'এই মাসে' }
  if (/এই\s*বছর|বছরে|year/i.test(q)) return { from: t.slice(0, 4) + '-01-01', to: t, label: 'এই বছরে' }
  if (/আজ|today/i.test(q)) return { from: t, to: t, label: 'আজ' }
  return null
}

const PERIOD_WORDS = /^(আজ|আজকের|আজকে|এই|গত|মোট|আমার|আমাদের|সব|মাসের|সপ্তাহের|বছরের|কত|কী|কি|কোন|কোনো)/

export function parseIntent(raw: string): Intent | null {
  const q = raw.trim()
  if (/ডকুমেন্ট|document/i.test(q)) return null // পুরনো নিয়ম সামলাবে

  // কাস্টমারের খরচ: "রহিম গত ৩ মাসে কত খরচ করেছে"
  if (/(খরচ|কিনেছ|কিনল|spent|spend)/i.test(q)) {
    const cut = q.search(/\s+(গত|এই|কত|মোট|এ পর্যন্ত|সর্বমোট|মাসে|বছরে|কি|কী)(\s|$)/)
    const name = (cut > 0 ? q.slice(0, cut) : '').trim()
    if (name && name.split(/\s+/).length <= 3 && !PERIOD_WORDS.test(name)) {
      return { kind: 'spend', name, period: parsePeriod(q) }
    }
    return { kind: 'expense', period: parsePeriod(q) || { from: today(), to: today(), label: 'আজ' } }
  }
  if (/(ব্যয়|expense)/i.test(q)) return { kind: 'expense', period: parsePeriod(q) || { from: today(), to: today(), label: 'আজ' } }
  if (/(বকেয়া|বাকি|\bdue\b)/i.test(q)) return { kind: 'due' }
  if (/(low\s*stock|লো\s*স্টক|স্টক.*(কম|শেষ|নেই)|কম.*স্টক|পণ্য.*শেষ|ফুরিয়ে)/i.test(q)) return { kind: 'lowstock' }
  if (!/(লাভ|profit)/i.test(q) && /((সেরা|সবচেয়ে|জনপ্রিয়|top|best).*(সার্ভিস|পণ্য|আইটেম|service|item)|(সার্ভিস|পণ্য).*(সেরা|জনপ্রিয়|বেশি বিক্রি))/i.test(q)) {
    return { kind: 'top', period: parsePeriod(q) || { from: today().slice(0, 7) + '-01', to: today(), label: 'এই মাসে' } }
  }
  if (!/(লাভ|profit)/i.test(q) && /(বিক্রি|বিক্রয়|সেল|\bsales?\b|আয়|ইনকাম|income|revenue)/i.test(q)) {
    return { kind: 'sales', period: parsePeriod(q) || { from: today(), to: today(), label: 'আজ' } }
  }
  return null
}

const dayBn = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('bn-BD', { timeZone: 'UTC', day: 'numeric', month: 'long' })
const periodOf = (from: string | null, to: string | null, fallback: 'today' | 'month'): Period => {
  const t = today()
  const f = from || (fallback === 'month' ? t.slice(0, 7) + '-01' : t)
  const e = to || (from ? t : t)
  return { from: f, to: e < f ? f : e, label: f === e ? dayBn(f) : `${dayBn(f)} – ${dayBn(e)}` }
}

/** AI-র যাচাই-করা ইনটেন্ট → আমাদের নিজস্ব ইনটেন্ট (AI শুধু কোনটা ও কোন সময় বলে; ডাটা আনে আমাদের RPC) */
export function fromAi(a: AiIntent): Intent | null {
  switch (a.intent) {
    case 'sales_summary': return { kind: 'sales', period: periodOf(a.from, a.to, 'today') }
    case 'expense_summary': return { kind: 'expense', period: periodOf(a.from, a.to, 'today') }
    case 'top_services': return { kind: 'top', period: periodOf(a.from, a.to, 'month') }
    case 'customer_spend': return a.name ? { kind: 'spend', name: a.name, period: a.from || a.to ? periodOf(a.from, a.to, 'month') : null } : null
    case 'due_customers': return { kind: 'due' }
    case 'low_stock': return { kind: 'lowstock' }
    case 'compare_periods': return a.from && a.to && a.b_from && a.b_to ? { kind: 'compare', a: periodOf(a.from, a.to, 'month'), b: periodOf(a.b_from, a.b_to, 'month') } : null
    default: return null
  }
}

const fail = (e: any): AssistantAnswer => ({
  summary: e?.message ? 'তথ্য আনতে সমস্যা হয়েছে (ফেজ H-এর SQL রান করা আছে কি?)' : String(e),
})

export async function runIntent(intent: Intent): Promise<AssistantAnswer> {
  try {
    if (intent.kind === 'compare') {
      const [ra, rb] = await Promise.all([
        supabase.rpc('ai_sales_summary', { p_from: intent.a.from, p_to: intent.a.to }),
        supabase.rpc('ai_sales_summary', { p_from: intent.b.from, p_to: intent.b.to }),
      ])
      if (ra.error || rb.error) throw ra.error || rb.error
      if (ra.data?.error) return { summary: ra.data.error }
      const A = ra.data, B = rb.data
      const ch = (x: number, y: number) => (y > 0 ? `${x >= y ? '+' : '−'}${Math.abs(Math.round(((x - y) / y) * 100)).toLocaleString('bn-BD')}%` : '—')
      const row = (title: string, x: number, y: number) => ({ title, subtitle: `${taka(x)} বনাম ${taka(y)} (${ch(x, y)})` })
      return {
        summary: `${intent.a.label} বনাম ${intent.b.label}: ক্যাশ-বুকে আয় ${taka(A.income)} বনাম ${taka(B.income)}।`,
        rows: [row('POS বিক্রি', A.pos_total, B.pos_total), row('অনলাইন অর্ডার', A.online_total, B.online_total), row('আয়', A.income, B.income), row('ব্যয়', A.expense, B.expense), row('নিট', A.net, B.net)],
      }
    }

    if (intent.kind === 'sales' || intent.kind === 'expense') {
      const { data, error } = await supabase.rpc('ai_sales_summary', { p_from: intent.period.from, p_to: intent.period.to })
      if (error) throw error
      if (data?.error) return { summary: data.error }
      const l = intent.period.label
      if (intent.kind === 'expense') {
        return { summary: `${l} মোট ব্যয় ${taka(data.expense)}।`, rows: [{ title: 'আয়', subtitle: taka(data.income) }, { title: 'নিট', subtitle: taka(data.net) }] }
      }
      return {
        summary: `${l} POS বিক্রি ${taka(data.pos_total)} (${data.pos_count}টি), অনলাইন অর্ডার ${taka(data.online_total)} (${data.online_count}টি)।`,
        rows: [
          { title: 'ক্যাশ-বুকে আয়', subtitle: taka(data.income) },
          { title: 'ব্যয়', subtitle: taka(data.expense) },
          { title: 'নিট', subtitle: taka(data.net) },
          { title: 'নতুন বাকি (POS)', subtitle: taka(data.pos_due) },
          { title: 'বাকি আদায়', subtitle: taka(data.due_collected) },
        ],
      }
    }

    if (intent.kind === 'top') {
      const { data, error } = await supabase.rpc('ai_top_services', { p_from: intent.period.from, p_to: intent.period.to, p_limit: 5 })
      if (error) throw error
      if (data?.error) return { summary: data.error }
      const items = (data.items || []) as { name: string; qty: number; revenue: number }[]
      if (items.length === 0) return { summary: `${intent.period.label} কোনো বিক্রি নেই।` }
      return {
        summary: `${intent.period.label} সেরা: “${items[0].name}” — ${taka(items[0].revenue)}।`,
        rows: items.map((i) => ({ title: i.name, subtitle: `${i.qty}টি • ${taka(i.revenue)}` })),
      }
    }

    if (intent.kind === 'due') {
      const { data, error } = await supabase.rpc('ai_due_customers', { p_limit: 8 })
      if (error) throw error
      if (data?.error) return { summary: data.error }
      const list = (data.customers || []) as { name: string; phone: string; total_due: number }[]
      const stu = Number(data.student_due_total) > 0 ? ` স্টুডেন্টদের কোর্স-ফি বকেয়া ${taka(data.student_due_total)} (${data.student_due_count} জন)।` : ''
      if (list.length === 0 && !stu) return { summary: 'কোনো বকেয়া নেই 🎉' }
      return {
        summary: `POS বকেয়া মোট ${taka(data.total_due)} (${data.count} জন); আজ নতুন বাকি ${taka(data.new_due_today)}।${stu}`,
        rows: list.map((c) => ({ title: c.name, subtitle: `${c.phone} • ${taka(c.total_due)}` })),
      }
    }

    if (intent.kind === 'lowstock') {
      const { data, error } = await supabase.rpc('ai_low_stock', { p_limit: 10 })
      if (error) throw error
      if (data?.error) return { summary: data.error }
      const items = (data.items || []) as { name: string; unit: string; quantity: number; threshold: number }[]
      if (items.length === 0) return { summary: 'সব পণ্যের স্টক ঠিক আছে ✅' }
      return {
        summary: `কম স্টকে ${items.length}টি পণ্য।`,
        rows: items.map((i) => ({ title: i.name, subtitle: `আছে ${i.quantity} ${i.unit} (সীমা ${i.threshold})` })),
      }
    }

    // spend — নাম দিয়ে; না পেলে "-এর/-র" ছেঁটে আবার
    const from = intent.period?.from || '2000-01-01'
    const label = intent.period?.label || 'সর্বমোট'
    const tryNames = [intent.name]
    const stripped = intent.name.replace(/(ের|এর|কে|র)$/, '')
    if (stripped !== intent.name && stripped.length >= 2) tryNames.push(stripped)
    for (const name of tryNames) {
      const { data, error } = await supabase.rpc('ai_customer_spend', { p_name: name, p_from: from })
      if (error) throw error
      if (data?.error) return { summary: data.error }
      const cs = (data.customers || []) as { name: string; phone: string; pos_total: number; pos_visits: number; online_total: number; due_now: number }[]
      if (cs.length === 0) continue
      const c = cs[0]
      const total = Number(c.pos_total) + Number(c.online_total)
      return {
        summary:
          cs.length === 1
            ? `${c.name} ${label} মোট ${taka(total)} খরচ করেছেন (দোকানে ${taka(c.pos_total)}, অনলাইনে ${taka(c.online_total)}); বর্তমান বকেয়া ${taka(c.due_now)}।`
            : `“${name}” নামে ${cs.length} জন পাওয়া গেছে — ${label} খরচ:`,
        rows: cs.length === 1
          ? [{ title: 'দোকানে আসা', subtitle: `${c.pos_visits} বার` }]
          : cs.map((x) => ({ title: `${x.name} (${x.phone})`, subtitle: `${taka(Number(x.pos_total) + Number(x.online_total))} • বকেয়া ${taka(x.due_now)}` })),
      }
    }
    return { summary: `“${intent.name}” নামে কোনো কাস্টমার পাওয়া যায়নি।` }
  } catch (e) {
    console.error('সহকারীর তথ্য আনতে ত্রুটি:', e)
    return fail(e)
  }
}
