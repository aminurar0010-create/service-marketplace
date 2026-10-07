// Vercel Serverless Function — ফেজ M: মালিকের Telegram বট
//
//   GET  /api/telegram   ← Vercel Cron (রাত ১০টা ঢাকা) → রাতের সারাংশ পাঠায়   [Authorization: Bearer CRON_SECRET]
//   POST /api/telegram   ← Telegram webhook → শুধু মালিকের প্রশ্নের উত্তর দেয়  [X-Telegram-Bot-Api-Secret-Token]
//
// নিরাপত্তা: (১) webhook-এ গোপন টোকেন যাচাই  (২) শুধু TELEGRAM_CHAT_ID-র ব্যক্তিগত চ্যাট — অন্য কেউ লিখলে কোনো উত্তরই নেই
//   (৩) ডাটাবেসে শুধু ২টা পড়া-মাত্র ফাংশন (owner_digest / owner_query) গোপন কোডসহ ডাকা হয়; service-role কী লাগে না
//   (৪) বট কখনো কিছু বদলায় না — সব উত্তর শুধু পড়া তথ্য।
//
// Vercel env: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_CHAT_ID, CRON_SECRET, OWNER_BOT_DB_SECRET
//             (SUPABASE_URL ও SUPABASE_ANON_KEY — ai.ts যেগুলো আগেই ব্যবহার করে)

import { createHash, timingSafeEqual } from 'node:crypto'

const TZ = 'Asia/Dhaka'

// ---------- ছোট সাহায্যকারী ----------
const sha = (s: string) => createHash('sha256').update(s).digest()
/** সময়-নিরাপদ তুলনা; ফাঁকা গোপন কোড কখনো মেলে না */
export const safeEq = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' && typeof b === 'string' && b.length > 0 && timingSafeEqual(sha(a), sha(b))

export const dhakaToday = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: TZ })
export const addDays = (d: string, n: number) => {
  const t = new Date(d + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}
const monthStart = (d: string) => d.slice(0, 8) + '01'

const bn = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 2 })
const money = (n: unknown) => '৳' + bn.format(Number(n) || 0)
const cnt = (n: unknown) => bn.format(Number(n) || 0)
const dateLabel = (d: string) =>
  new Date(d + 'T06:00:00Z').toLocaleDateString('bn-BD', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const METHOD: Record<string, string> = { cash: 'ক্যাশ', bkash: 'বিকাশ', nagad: 'নগদ (অ্যাপ)', rocket: 'রকেট', other: 'অন্যান্য', unspecified: 'অনির্দিষ্ট' }
const TICKET_ICON: Record<string, string> = { bus: '🚌', train: '🚆', air: '✈️' }
const TICKET_STATUS: Record<string, string> = { requested: 'অনুরোধ', booked: 'বুকড' }

type J = any
const bad = (x: J) => !x || typeof x !== 'object' || x.error

// ---------- সারাংশ/উত্তরের লেখা ----------
function methodsLine(m: J): string | null {
  const e = m && typeof m === 'object' ? Object.entries(m).filter(([, v]) => Number(v) > 0) : []
  if (!e.length) return null
  return e.sort((a, b) => Number(b[1]) - Number(a[1])).map(([k, v]) => `${METHOD[k] || k} ${money(v)}`).join(' · ')
}

function salesBlock(s: J, methods: J, label: string): string[] {
  if (bad(s)) return [`💰 ${label}: তথ্য পাওয়া গেল না`]
  const out = [
    `💰 বিক্রি (${label})`,
    `   POS ${money(s.pos_total)} (${cnt(s.pos_count)} টি) · অনলাইন ${money(s.online_total)} (${cnt(s.online_count)} টি)`,
    `📥 আয় ${money(s.income)} · 📤 ব্যয় ${money(s.expense)}`,
    `${Number(s.net) >= 0 ? '✅' : '⚠️'} নিট ${money(s.net)}`,
  ]
  const ml = methodsLine(methods)
  if (ml) out.push(`💳 মাধ্যম: ${ml}`)
  if (Number(s.pos_due) > 0 || Number(s.due_collected) > 0) out.push(`🧾 নতুন বাকি ${money(s.pos_due)} · বাকি আদায় ${money(s.due_collected)}`)
  return out
}

function topBlock(t: J): string[] {
  if (bad(t)) return []
  const items = Array.isArray(t.items) ? t.items : []
  if (!items.length) return ['🔝 সেরা সার্ভিস: কোনো বিক্রি নেই']
  return ['🔝 সেরা সার্ভিস', ...items.map((i: J, k: number) => `   ${cnt(k + 1)}. ${i.name} — ${money(i.revenue)} (${cnt(i.qty)} টি)`)]
}

function dueBlock(d: J, a: J, max = 5): string[] {
  if (bad(d)) return ['🧾 বকেয়া: তথ্য পাওয়া গেল না']
  const out = [`🧾 মোট বকেয়া ${money(d.total_due)} (${cnt(d.count)} জন)`]
  const list = Array.isArray(d.customers) ? d.customers.slice(0, max) : []
  for (const c of list) out.push(`   • ${c.name} — ${money(c.total_due)}`)
  if (!bad(a) && Number(a.old_due_count) > 0) out.push(`   ⏳ ৩০ দিনের পুরনো: ${cnt(a.old_due_count)} জন, ${money(a.old_due_total)}`)
  if (Number(d.student_due_total) > 0) out.push(`🎓 স্টুডেন্টের কোর্স-ফি বকেয়া ${money(d.student_due_total)} (${cnt(d.student_due_count)} জন)`)
  return out
}

function stockBlock(s: J, a: J, max = 5): string[] {
  if (bad(s)) return ['📦 স্টক: তথ্য পাওয়া গেল না']
  const items = Array.isArray(s.items) ? s.items : []
  if (!items.length) return ['📦 স্টক: সব ঠিক আছে ✅']
  const out = [`📦 কম স্টক (${cnt(items.length)}${items.length >= max ? '+' : ''} টি)`]
  for (const i of items.slice(0, max)) out.push(`   • ${i.name}: ${cnt(i.quantity)} ${i.unit || ''} (সীমা ${cnt(i.threshold)})`.replace(/\s+\(/, ' ('))
  if (!bad(a) && Number(a.out_of_stock_count) > 0) out.push(`   ❌ স্টক শেষ: ${cnt(a.out_of_stock_count)} টি`)
  return out
}

function ticketBlock(t: J): string[] {
  if (bad(t)) return ['🎫 টিকিট: তথ্য পাওয়া গেল না']
  const items = Array.isArray(t.items) ? t.items : []
  const head = `🎫 যাত্রা — ${t.date ? dateLabel(String(t.date).slice(0, 10)) : ''}`
  const out = items.length
    ? [head, ...items.map((i: J) => `   ${TICKET_ICON[i.type] || '🎫'} ${i.from} → ${i.to}${i.time ? ' · ' + i.time : ''} — ${i.name || 'নাম নেই'}${Number(i.count) > 1 ? ` (${cnt(i.count)} জন)` : ''} [${TICKET_STATUS[i.status] || i.status}]`)]
    : [`${head}: কোনো টিকিট নেই`]
  if (Number(t.pending) > 0) out.push(`   ⏳ বুকিংয়ের অপেক্ষায় ${cnt(t.pending)} টি অনুরোধ`)
  return out
}

function healthBlock(h: J): string[] {
  if (bad(h)) return ['🩺 হেলথ চেক: তথ্য পাওয়া গেল না']
  const checks = (Array.isArray(h.checks) ? h.checks : []).filter((c: J) => Number(c.count) > 0)
  if (!checks.length) return ['🩺 হেলথ চেক: সব ঠিক ✅']
  return ['🩺 হেলথ চেক', ...checks.map((c: J) => `   ${c.key === 'no_method' ? 'ℹ️' : '⚠️'} ${c.label}: ${cnt(c.count)}`)]
}

export function digestText(d: J): string {
  const date = String(d?.date || '').slice(0, 10)
  const out = [`📊 দৈনিক সারাংশ`, `📅 ${date ? dateLabel(date) : ''}`, '']
  out.push(...salesBlock(d?.sales, d?.methods, 'আজ'), '')
  out.push(...topBlock(d?.top), '')
  out.push(...dueBlock(d?.dues, d?.alerts, 3), '')
  out.push(...stockBlock(d?.stock, d?.alerts, 5), '')
  out.push(...ticketBlock(d?.tickets), '')
  out.push(...healthBlock(d?.health))
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const HELP = `আমি শুধু পড়ে উত্তর দিই, কিছু বদলাই না। লিখুন:
• সারাংশ — আজকের পূর্ণ সারাংশ (গতকাল সারাংশ)
• আজ কত বিক্রি / গতকাল বিক্রি / এই মাস বিক্রি / গত মাস বিক্রি / গত ৭ দিন বিক্রি
• সেরা সার্ভিস (এই মাস)
• বকেয়া
• স্টক
• টিকিট — কালকের যাত্রা
• হেলথ — হিসাবের গরমিল`

// ---------- প্রশ্ন বোঝা (নিয়ম-ভিত্তিক; AI লাগে না, ডাটা-বিশ্লেষণ ডাটাবেসেই) ----------
export type Query =
  | { kind: 'help' } | { kind: 'myid' } | { kind: 'unknown' }
  | { kind: 'digest'; date: string }
  | { kind: 'sales' | 'top'; from: string; to: string; label: string }
  | { kind: 'due' | 'stock' | 'health' }
  | { kind: 'tickets'; from: string }

export function parsePeriod(t: string, today: string): { from: string; to: string; label: string } {
  if (/গত\s*মাস|last\s*month/.test(t)) {
    const last = addDays(monthStart(today), -1)
    return { from: monthStart(last), to: last, label: 'গত মাস' }
  }
  if (/এই\s*মাস|this\s*month/.test(t)) return { from: monthStart(today), to: today, label: 'এই মাস' }
  if (/সপ্তাহ|[৭7]\s*দিন|week|7\s*days/.test(t)) return { from: addDays(today, -6), to: today, label: 'গত ৭ দিন' }
  if (/গতকাল|yesterday/.test(t)) { const y = addDays(today, -1); return { from: y, to: y, label: 'গতকাল' } }
  return { from: today, to: today, label: 'আজ' }
}

export function parseQuery(raw: string, today: string): Query {
  const t = raw.toLowerCase().replace(/@\w+bot\b/g, '').replace(/[?？!।.,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (/^\/?myid$/.test(t)) return { kind: 'myid' }
  if (!t || /^\/?(start|help)$/.test(t) || /সাহায্য|কী পারো|কি পারো|\bhelp\b/.test(t)) return { kind: 'help' }
  const p = parsePeriod(t, today)
  if (/সারাংশ|রিপোর্ট|summary|report|সামারি/.test(t)) return { kind: 'digest', date: p.from }
  if (/হেলথ|health|গরমিল/.test(t)) return { kind: 'health' }
  if (/বকেয়া|বাকি|due/.test(t)) return { kind: 'due' }
  if (/স্টক|মজুদ|stock/.test(t)) return { kind: 'stock' }
  if (/টিকিট|ticket|যাত্রা/.test(t)) return { kind: 'tickets', from: today }
  if (/সেরা|জনপ্রিয়|\btop\b/.test(t)) return { kind: 'top', ...p }
  if (/বিক্রি|বিক্রয়|আয়|খরচ|ব্যয়|লাভ|নিট|sales|income|expense|profit|কত/.test(t)) return { kind: 'sales', ...p }
  return { kind: 'unknown' }
}

// ---------- বাইরের ডাক ----------
function cfg() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    anon: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    dbSecret: process.env.OWNER_BOT_DB_SECRET || '',
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: (process.env.TELEGRAM_CHAT_ID || '').trim(),
    whSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    cronSecret: process.env.CRON_SECRET || '',
  }
}

async function rpc(name: string, body: Record<string, unknown>): Promise<J> {
  const c = cfg()
  if (!c.url || !c.anon || !c.dbSecret) throw new Error('সার্ভার সেটিং অসম্পূর্ণ (SUPABASE_URL / ANON / OWNER_BOT_DB_SECRET)')
  const r = await fetch(`${c.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: c.anon, Authorization: `Bearer ${c.anon}` },
    body: JSON.stringify({ p_secret: c.dbSecret, ...body }),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) throw new Error(`ডাটাবেস ${r.status}`) // গোপন কোড/ভেতরের বার্তা কখনো বাইরে যায় না
  return r.json()
}

async function tgSend(chatId: string, text: string) {
  const c = cfg()
  if (!c.token) throw new Error('TELEGRAM_BOT_TOKEN নেই')
  // Telegram-এর সীমা ৪০৯৬ অক্ষর — লাইন ধরে ভাগ
  const parts: string[] = []
  let cur = ''
  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > 3800) { parts.push(cur); cur = line } else cur = cur ? cur + '\n' + line : line
  }
  if (cur) parts.push(cur)
  for (const part of parts) {
    const r = await fetch(`https://api.telegram.org/bot${c.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: part, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) throw new Error(`Telegram ${r.status}`)
  }
}

export async function answer(q: Query): Promise<string> {
  switch (q.kind) {
    case 'help': return HELP
    case 'unknown': return 'প্রশ্নটা বুঝতে পারিনি 🙏\n\n' + HELP
    case 'myid': return ''
    case 'digest': return digestText(await rpc('owner_digest', { p_date: q.date }))
    case 'sales': {
      const s = await rpc('owner_query', { p_kind: 'sales', p_from: q.from, p_to: q.to })
      return salesBlock(s, s?.methods, q.label).join('\n')
    }
    case 'top': {
      const t = await rpc('owner_query', { p_kind: 'top', p_from: q.from, p_to: q.to })
      return [`(${q.label})`, ...topBlock(t)].join('\n')
    }
    case 'due': { const d = await rpc('owner_query', { p_kind: 'due' }); return dueBlock(d, d?.alerts, 10).join('\n') }
    case 'stock': { const s = await rpc('owner_query', { p_kind: 'stock' }); return stockBlock(s, s?.alerts, 15).join('\n') }
    case 'tickets': return ticketBlock(await rpc('owner_query', { p_kind: 'tickets', p_from: q.from }))
    case 'health': return healthBlock(await rpc('owner_query', { p_kind: 'health' })).join('\n')
  }
}

// ---------- হ্যান্ডলার ----------
export default async function handler(req: any, res: any) {
  const c = cfg()

  // ক) Vercel Cron — রাতের সারাংশ
  if (req.method === 'GET') {
    // CRON_SECRET না বসানো থাকলে কেউই ঢুকতে পারবে না ("Bearer " ফাঁকা দিয়েও নয়)
    if (!c.cronSecret || !safeEq(req.headers?.authorization, `Bearer ${c.cronSecret}`)) return res.status(401).json({ ok: false })
    if (!c.chatId) return res.status(503).json({ ok: false, message: 'TELEGRAM_CHAT_ID নেই' })
    try {
      await tgSend(c.chatId, await answer({ kind: 'digest', date: dhakaToday() }))
      return res.status(200).json({ ok: true })
    } catch (e) {
      try { await tgSend(c.chatId, '⚠️ আজকের রাতের সারাংশ বানানো যায়নি: ' + (e instanceof Error ? e.message : 'অজানা ত্রুটি')) } catch { /* কিছু করার নেই */ }
      return res.status(500).json({ ok: false })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false })

  // খ) Telegram webhook — গোপন টোকেন না মিললে সরাসরি বাতিল
  if (!safeEq(req.headers?.['x-telegram-bot-api-secret-token'], c.whSecret)) return res.status(401).json({ ok: false })

  const msg = req.body?.message || req.body?.edited_message
  const text: string = typeof msg?.text === 'string' ? msg.text.slice(0, 300) : ''
  const chat = msg?.chat
  if (!chat || !text) return res.status(200).json({ ok: true })
  const chatStr = String(chat.id)

  // চ্যাট আইডি এখনো বসানো না থাকলে (প্রথম সেটআপ) শুধু "myid" উত্তর দেয় — নিজের আইডি জানার জন্য, আর কিছু নয়
  if (!c.chatId) {
    if (chat.type === 'private' && parseQuery(text, dhakaToday()).kind === 'myid') {
      try { await tgSend(chatStr, `আপনার চ্যাট আইডি: ${chatStr}\nএটা Vercel-এ TELEGRAM_CHAT_ID নামে বসান, তারপর আবার deploy করুন।`) } catch { /* ignore */ }
    }
    return res.status(200).json({ ok: true })
  }

  // অন্য কেউ (বা গ্রুপ) লিখলে — কোনো উত্তর নেই, লগও নেই
  if (chat.type !== 'private' || chatStr !== c.chatId || String(msg?.from?.id ?? chat.id) !== c.chatId) return res.status(200).json({ ok: true })

  const today = dhakaToday()
  let reply: string
  try {
    const q = parseQuery(text, today)
    reply = q.kind === 'myid' ? `আপনার চ্যাট আইডি: ${chatStr}` : await answer(q)
  } catch (e) {
    reply = '⚠️ এখন তথ্য আনা গেল না: ' + (e instanceof Error ? e.message : 'অজানা ত্রুটি') + '\nকিছুক্ষণ পরে আবার চেষ্টা করুন।'
  }
  try { await tgSend(chatStr, reply || HELP) } catch { /* Telegram ব্যর্থ হলে আবার চেষ্টা না করাই ভালো — 200 দিই */ }
  return res.status(200).json({ ok: true })
}
