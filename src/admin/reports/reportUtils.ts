import { supabase } from '../../lib/supabase'

export const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')

/** ঢাকা সময় অনুযায়ী আজকের তারিখ (YYYY-MM-DD) */
export const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

const addDays = (date: string, days: number) => {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** [start, end) — ঢাকা সময়ের (UTC+6, ডেলাইট সেভিং নেই) দিন/সময়সীমা, ISO আকারে */
export const rangeIso = (fromDate: string, toDateInclusive: string) => ({
  start: `${fromDate}T00:00:00+06:00`,
  end: `${addDays(toDateInclusive, 1)}T00:00:00+06:00`,
})

export type RangeKey = 'today' | 'week' | 'month'
export const RANGE_LABELS: Record<RangeKey, string> = { today: 'আজ', week: 'গত ৭ দিন', month: 'এই মাস' }

export const rangeDates = (key: RangeKey) => {
  const today = todayDhaka()
  if (key === 'today') return { from: today, to: today }
  if (key === 'week') return { from: addDays(today, -6), to: today }
  return { from: today.slice(0, 7) + '-01', to: today }
}

export const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

/** Supabase-এর ১০০০ সারির সীমা পেরিয়ে সব সারি আনে */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

export { supabase }

/** CSV ডাউনলোড (UTF-8 BOM সহ — Excel-এ বাংলা ঠিকভাবে খোলে) */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** শুধু রিপোর্টটুকু প্রিন্ট (অ্যাডমিন সাইডবার ছাড়া) */
export function printReport(title: string, subtitle: string, tables: { heading: string; rows: string[][] }[]) {
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) {
    alert('প্রিন্ট উইন্ডো খুলতে পারছি না — ব্রাউজারের পপ-আপ অনুমতি দিন')
    return
  }
  const body = tables
    .map(
      (t) =>
        `<h3>${escHtml(t.heading)}</h3><table>${t.rows
          .map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${escHtml(c)}</th>` : `<td>${escHtml(c)}</td>`)).join('')}</tr>`)
          .join('')}</table>`
    )
    .join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title>
<style>body{font-family:sans-serif;padding:24px;color:#111}h1{font-size:20px;margin:0}p{color:#555;margin:4px 0 16px}
h3{font-size:15px;margin:18px 0 6px}table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#f3f4f6}</style></head>
<body><h1>নিউ প্রিন্টার্স — ${escHtml(title)}</h1><p>${escHtml(subtitle)}</p>${body}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
}
