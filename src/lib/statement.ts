import { format } from 'date-fns'
import { supabase } from './supabase'
import { normalizePhone } from './phone'

/**
 * ফেজ ৭ — বাকির বিবরণী (Statement)।
 * একজন কাস্টমারের POS-এর বাকি ও অর্ডারের বাকি এক তালিকায় মিলিয়ে এক কাগজে প্রিন্ট।
 * শুধু পড়া — কোনো হিসাব বদলায় না; নতুন টেবিল/SQL লাগে না।
 */

export interface StatementPayment {
  date: string
  amount: number
  label: string
}

export interface StatementRow {
  key: string
  kind: 'pos' | 'order'
  ref: string // ইনভয়েস নং বা ট্র্যাকিং নম্বর
  title: string // "দোকানের বিক্রি" / "অনলাইন/কুইক অর্ডার"
  desc?: string // কী কাজ/পণ্য (শুধু পূর্ণ হিসাবে)
  date: string
  total: number
  paid: number
  due: number
  payments: StatementPayment[]
}

export interface StatementData {
  rows: StatementRow[]
}

const num = (v: unknown) => Number(v ?? 0) || 0
const round2 = (n: number) => Math.round(n * 100) / 100

const METHOD_LABELS: Record<string, string> = {
  cash: 'নগদ',
  bkash: 'বিকাশ',
  nagad: 'নগদ (Nagad)',
  rocket: 'রকেট',
  other: 'অন্যান্য',
}

/** কাস্টমারের সব বাকি কাজ (POS + অর্ডার) তারিখ অনুযায়ী (পুরনো আগে) */
export async function fetchStatement(customerId: string | null, phone: string): Promise<StatementData> {
  const normPhone = normalizePhone(phone)
  const rows: StatementRow[] = []

  // ── ১) POS-এর বাকি ──
  if (customerId) {
    const { data: sales, error } = await supabase
      .from('pos_sales')
      .select('id, invoice_no, sale_number, created_at, total_amount, paid_amount, due_amount')
      .eq('shop_customer_id', customerId)
      .eq('status', 'completed')
      .gt('due_amount', 0)
      .order('created_at', { ascending: true })
    if (error) throw error

    const saleIds = (sales || []).map((s: any) => s.id)
    const payBySale = new Map<string, StatementPayment[]>()
    if (saleIds.length > 0) {
      const { data: pays, error: pErr } = await supabase
        .from('sale_payments')
        .select('sale_id, amount, kind, method, created_at')
        .in('sale_id', saleIds)
        .order('created_at', { ascending: true })
      if (pErr) throw pErr
      ;(pays || []).forEach((p: any) => {
        const list = payBySale.get(p.sale_id) || []
        list.push({
          date: p.created_at,
          amount: num(p.amount),
          label: (p.kind === 'due_collection' ? 'আদায় ' : 'বিক্রির সময় ') + (METHOD_LABELS[p.method] || ''),
        })
        payBySale.set(p.sale_id, list)
      })
    }

    ;(sales || []).forEach((s: any) => {
      const paid = num(s.paid_amount)
      const payments = payBySale.get(s.id) || []
      // পেমেন্ট-লগ ও paid_amount না মিললে (পুরনো ডাটা) বাকিটুকু "আগে পাওয়া" হিসেবে
      const logged = payments.reduce((a, p) => a + p.amount, 0)
      if (paid - logged > 0.009) {
        payments.unshift({ date: s.created_at, amount: round2(paid - logged), label: 'আগে পাওয়া' })
      }
      rows.push({
        key: 'pos-' + s.id,
        kind: 'pos',
        ref: s.invoice_no || s.sale_number,
        title: 'দোকানের বিক্রি',
        date: s.created_at,
        total: num(s.total_amount),
        paid,
        due: num(s.due_amount),
        payments,
      })
    })
  }

  // ── ২) অর্ডারের বাকি (order_dues ভিউ — "বাকি আদায়" ট্যাবের হুবহু একই নিয়ম) ──
  let orderQuery = supabase
    .from('order_dues')
    .select('order_id, tracking_id, created_at, total_amount, paid_amount, due_amount, shop_customer_id, customer_phone')
    .order('created_at', { ascending: true })
  if (customerId) {
    // কাস্টমারে লিংক না হওয়া পুরনো অর্ডার ফোন নম্বর ধরে মেলানো হয়
    orderQuery = orderQuery.or(
      `shop_customer_id.eq.${customerId},and(shop_customer_id.is.null,customer_phone.eq.${normPhone})`
    )
  } else {
    orderQuery = orderQuery.eq('customer_phone', normPhone)
  }
  const { data: orders, error: oErr } = await orderQuery
  if (oErr) throw oErr

  const orderIds = (orders || []).map((o: any) => o.order_id)
  const payByOrder = new Map<string, StatementPayment[]>()
  if (orderIds.length > 0) {
    const { data: pays, error: pErr } = await supabase
      .from('order_payments')
      .select('order_id, amount, method, created_at')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true })
    if (pErr) throw pErr
    ;(pays || []).forEach((p: any) => {
      const list = payByOrder.get(p.order_id) || []
      list.push({ date: p.created_at, amount: num(p.amount), label: METHOD_LABELS[p.method] || '' })
      payByOrder.set(p.order_id, list)
    })
  }

  ;(orders || []).forEach((o: any) => {
    const paid = num(o.paid_amount)
    const payments = payByOrder.get(o.order_id) || []
    const logged = payments.reduce((a, p) => a + p.amount, 0)
    if (paid - logged > 0.009) {
      payments.unshift({ date: o.created_at, amount: round2(paid - logged), label: 'আগে পাওয়া' })
    }
    rows.push({
      key: 'order-' + o.order_id,
      kind: 'order',
      ref: o.tracking_id,
      title: 'অর্ডার',
      date: o.created_at,
      total: num(o.total_amount),
      paid,
      due: num(o.due_amount),
      payments,
    })
  })

  rows.sort((a, b) => a.date.localeCompare(b.date))
  return { rows }
}

// ইন-কোয়েরি লম্বা হলে URL বড় হয়ে যায় — তাই ১০০টি করে ভাগ
async function selectIn<T = any>(table: string, columns: string, col: string, ids: string[], order?: string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 100) {
    let q = supabase.from(table).select(columns).in(col, ids.slice(i, i + 100))
    if (order) q = q.order(order, { ascending: true })
    const { data, error } = await q
    if (error) throw error
    out.push(...((data as T[]) || []))
  }
  return out
}

/**
 * পূর্ণ হিসাব — কাস্টমারের সব কাজ (বাকি থাকুক বা না থাকুক): কবে কী কাজ, মোট কত, কবে কত টাকা দিয়েছে।
 * বাতিল/ফেরত দেওয়া কাজ বাদ। শুধু পড়া।
 */
export async function fetchFullStatement(customerId: string | null, phone: string): Promise<StatementData> {
  const normPhone = normalizePhone(phone)
  const rows: StatementRow[] = []

  // ── POS বিক্রি ──
  if (customerId) {
    const { data: sales, error } = await supabase
      .from('pos_sales')
      .select('id, invoice_no, sale_number, created_at, total_amount, paid_amount, due_amount')
      .eq('shop_customer_id', customerId)
      .eq('status', 'completed')
      .order('created_at', { ascending: true })
    if (error) throw error
    const saleIds = (sales || []).map((s: any) => s.id)
    const items = await selectIn('pos_sale_items', 'sale_id, item_name, quantity', 'sale_id', saleIds)
    const pays = await selectIn('sale_payments', 'sale_id, amount, kind, method, created_at', 'sale_id', saleIds, 'created_at')
    const itemsBySale = new Map<string, string[]>()
    items.forEach((it: any) => {
      const l = itemsBySale.get(it.sale_id) || []
      l.push(num(it.quantity) > 1 ? `${it.item_name} × ${num(it.quantity).toLocaleString('bn-BD')}` : String(it.item_name))
      itemsBySale.set(it.sale_id, l)
    })
    const payBySale = new Map<string, StatementPayment[]>()
    pays.forEach((p: any) => {
      const l = payBySale.get(p.sale_id) || []
      l.push({
        date: p.created_at,
        amount: num(p.amount),
        label: (p.kind === 'due_collection' ? 'বাকি আদায় ' : 'বিক্রির সময় ') + (METHOD_LABELS[p.method] || ''),
      })
      payBySale.set(p.sale_id, l)
    })
    ;(sales || []).forEach((s: any) => {
      const paid = num(s.paid_amount)
      const payments = payBySale.get(s.id) || []
      const logged = payments.reduce((a, p) => a + p.amount, 0)
      if (paid - logged > 0.009) payments.unshift({ date: s.created_at, amount: round2(paid - logged), label: 'আগে পাওয়া' })
      rows.push({
        key: 'pos-' + s.id,
        kind: 'pos',
        ref: s.invoice_no || s.sale_number,
        title: 'দোকানের বিক্রি',
        desc: (itemsBySale.get(s.id) || []).join(', '),
        date: s.created_at,
        total: num(s.total_amount),
        paid,
        due: num(s.due_amount),
        payments,
      })
    })
  }

  // ── অর্ডার (বাতিল/প্রত্যাখ্যাত/ফেরত বাদ) ──
  let oq = supabase
    .from('orders')
    .select('id, tracking_id, service_id, created_at, total_amount, paid_amount, payment_status, credit_sale, status, shop_customer_id, customer_phone')
    .not('status', 'in', '(cancelled,rejected)')
    .in('payment_status', ['paid', 'unpaid'])
    .order('created_at', { ascending: true })
  oq = customerId
    ? oq.or(`shop_customer_id.eq.${customerId},and(shop_customer_id.is.null,customer_phone.eq.${normPhone})`)
    : oq.eq('customer_phone', normPhone)
  const { data: allOrders, error: oErr } = await oq
  if (oErr) throw oErr
  // বাকি আদায় ট্যাবের নিয়মের সঙ্গে মিল: পরিশোধিত, অথবা বাকিতে দেওয়া/কিছু পাওয়া অর্ডার (সাধারণ অপরিশোধিত অনলাইন অর্ডার নয়)
  const orders = (allOrders || []).filter((o: any) => o.payment_status === 'paid' || o.credit_sale || num(o.paid_amount) > 0)

  const orderIds = (orders || []).map((o: any) => o.id)
  const serviceIds = Array.from(new Set((orders || []).map((o: any) => o.service_id).filter(Boolean))) as string[]
  const services = await selectIn('services', 'id, name', 'id', serviceIds)
  const serviceName = new Map<string, string>(services.map((sv: any) => [sv.id, sv.name]))
  const opays = await selectIn('order_payments', 'order_id, amount, method, created_at', 'order_id', orderIds, 'created_at')
  const payByOrder = new Map<string, StatementPayment[]>()
  opays.forEach((p: any) => {
    const l = payByOrder.get(p.order_id) || []
    l.push({ date: p.created_at, amount: num(p.amount), label: METHOD_LABELS[p.method] || '' })
    payByOrder.set(p.order_id, l)
  })
  // পুরনো (লগ-ছাড়া) পরিশোধিত অর্ডারের টাকা পাওয়ার তারিখ ক্যাশ-বুক থেকে
  const cash = await selectIn('cash_transactions', 'order_id, entry_date, type', 'order_id', orderIds)
  const cashDate = new Map<string, string>()
  cash
    .filter((c: any) => c.type === 'income')
    .forEach((c: any) => {
      const prev = cashDate.get(c.order_id)
      if (!prev || c.entry_date < prev) cashDate.set(c.order_id, c.entry_date)
    })

  ;(orders || []).forEach((o: any) => {
    const total = num(o.total_amount)
    // "পরিশোধিত" অর্ডারে পুরো টাকা পাওয়া ধরা হয়; নইলে যত পেয়েছি
    const paid = o.payment_status === 'paid' ? total : Math.min(num(o.paid_amount), total)
    const payments = payByOrder.get(o.id) || []
    const logged = payments.reduce((a, p) => a + p.amount, 0)
    if (paid - logged > 0.009) {
      const d = cashDate.get(o.id)
      payments.unshift({ date: d ? d + 'T12:00:00+06:00' : o.created_at, amount: round2(paid - logged), label: 'পরিশোধ' })
    }
    rows.push({
      key: 'order-' + o.id,
      kind: 'order',
      ref: o.tracking_id,
      title: 'অর্ডার',
      desc: serviceName.get(o.service_id) || '',
      date: o.created_at,
      total,
      paid,
      due: Math.max(round2(total - paid), 0),
      payments,
    })
  })

  rows.sort((a, b) => a.date.localeCompare(b.date))
  return { rows }
}

/**
 * কাস্টমারের আগের মোট বাকি (POS + অর্ডার), একটি নির্দিষ্ট বিক্রি বাদে — নতুন POS মেমোতে "পূর্বের বাকী" দেখাতে।
 * ব্যর্থ হলে ০ ধরা হয় (মেমো প্রিন্ট আটকায় না)।
 */
export async function fetchPreviousDue(customerId: string | null | undefined, phone: string | null | undefined, excludeSaleId: string): Promise<number> {
  if (!customerId) return 0
  try {
    const { rows } = await fetchStatement(customerId, phone || '')
    return round2(rows.filter((r) => r.key !== 'pos-' + excludeSaleId).reduce((a, r) => a + r.due, 0))
  } catch (e) {
    console.error('পূর্বের বাকি লোড ত্রুটি:', e)
    return 0
  }
}

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const day = (iso: string) => format(new Date(iso), 'dd/MM/yyyy')

export function statementTotals(rows: StatementRow[]) {
  return {
    count: rows.length,
    total: round2(rows.reduce((a, r) => a + r.total, 0)),
    paid: round2(rows.reduce((a, r) => a + r.paid, 0)),
    due: round2(rows.reduce((a, r) => a + r.due, 0)),
  }
}

/** নির্বাচিত সারিগুলো A4 কাগজে প্রিন্ট — ডিজাইন POS মেমো (memo.ts)-র মতো */
export function printStatement(customer: { name: string; phone: string; code?: string | null }, rows: StatementRow[], title = 'বাকির বিবরণী', full = false) {
  const win = window.open('', '_blank', 'width=900,height=900')
  if (!win) {
    alert('প্রিন্ট উইন্ডো খুলতে ব্যর্থ হয়েছে। পপ-আপ ব্লক করা থাকলে অনুমতি দিন।')
    return
  }
  const t = statementTotals(rows)
  const bn = (n: number) => Number(round2(n)).toLocaleString('bn-BD', { maximumFractionDigits: 2 })
  const today = new Date().toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' })

  const allPays = rows
    .flatMap((r) => r.payments.map((p) => ({ ...p, ref: r.ref })))
    .sort((a, b) => a.date.localeCompare(b.date))
  const payList =
    full && allPays.length > 0
      ? `<div class="pl"><h3>টাকা জমার তারিখভিত্তিক তালিকা</h3>
<table class="t"><thead><tr><th>#</th><th style="width:16%">তারিখ</th><th>কোন কাজে</th><th style="width:22%">মাধ্যম</th><th style="width:16%">টাকা</th></tr></thead><tbody>${allPays
          .map(
            (p, i) =>
              `<tr><td class="c">${(i + 1).toLocaleString('bn-BD')}</td><td class="nw">${day(p.date)}</td><td>${esc(p.ref)}</td><td>${esc((p.label || '').replace('বিক্রির সময় ', '').replace('আদায় ', '').trim() || '—')}</td><td class="r">${bn(p.amount)}</td></tr>`
          )
          .join('')}</tbody></table></div>`
      : ''

  const body = rows
    .map((r, i) => {
      const pays = r.payments
        .map((p) => `<div class="pay">${day(p.date)} — ৳${bn(p.amount)}${p.label ? ` (${esc(p.label.trim())})` : ''}</div>`)
        .join('')
      return `<tr>
        <td class="c">${(i + 1).toLocaleString('bn-BD')}</td>
        <td class="nw">${day(r.date)}</td>
        <td><b>${esc(r.ref)}</b> <span class="kind">${esc(r.title)}</span>${r.desc ? `<div class="desc">${esc(r.desc)}</div>` : ''}${pays}</td>
        <td class="r">${bn(r.total)}</td>
        <td class="r">${bn(r.paid)}</td>
        <td class="r dueC">${r.due > 0 ? bn(r.due) : '<span class="ok">পরিশোধিত</span>'}</td>
      </tr>`
    })
    .join('')

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — ${esc(customer.name)}</title>
<style>
@page{size:A4 portrait;margin:10mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Noto Sans Bengali','Kalpurush',sans-serif;color:#17323b;font-size:12.5px;background:#fbf7ea}
.page{padding:4mm 4mm 2mm}
.head{display:flex;gap:10px;align-items:center;border-bottom:2px solid #b8860b;padding-bottom:6px}
.logo{width:64px;height:64px;border-radius:12px;background:#0f4c5c;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.logo img{width:100%;height:100%;object-fit:contain}
.title{flex:1;text-align:center}
.title h1{margin:0;font-size:28px;color:#0f4c5c;line-height:1.1}
.title .tag{font-size:12.5px;font-weight:700;color:#8a6508}
.pill{display:inline-block;margin-top:3px;background:#0f4c5c;color:#fff;border-radius:4px;padding:1px 10px;font-size:11px}
.contact{font-size:11px;text-align:center;margin:5px 0 2px;line-height:1.5}
.services{font-size:9.5px;text-align:center;color:#444;border-top:1px solid #b8860b;border-bottom:1px solid #b8860b;padding:3px 0;margin:4px 0 8px}
h2{text-align:center;margin:6px 0;font-size:17px;color:#0f4c5c;letter-spacing:.5px}
.meta{display:flex;justify-content:space-between;margin:3px 0}
.field{margin:5px 0;display:flex;gap:4px}
.field span.v{flex:1;border-bottom:1px dotted #555;min-height:15px}
table.t{width:100%;border-collapse:collapse;margin-top:8px}
thead{display:table-header-group}
tr{page-break-inside:avoid}
th{background:#0f4c5c;color:#fff;font-weight:600;padding:4px;border:1px solid #0f4c5c}
td{border:1px solid #9bb3b9;padding:3px 5px;vertical-align:top}
.c{text-align:center;width:26px}.r{text-align:right;white-space:nowrap}.nw{white-space:nowrap}
.dueC{font-weight:700;color:#b00020}
.kind{font-size:10px;color:#666}
.ok{color:#1b7a3d;font-weight:600;font-size:11px}
.pl{margin-top:12px;page-break-inside:auto}
.pl h3{margin:0 0 4px;font-size:13px;color:#0f4c5c}
.pay{font-size:10px;color:#555;margin-top:1px}
.desc{font-size:11.5px;margin-top:1px}
.bottom{display:flex;justify-content:flex-end;margin-top:8px;page-break-inside:avoid}
.sum{width:50%}
.line{display:flex;justify-content:space-between;border:1px solid #0f4c5c;margin-bottom:3px;padding:3px 8px;background:#e8f1f3}
.line.due b{color:#b00020}
.sigs{display:flex;justify-content:space-between;margin-top:30px;page-break-inside:avoid}
.sig{width:42%;text-align:center;border-top:1px solid #8a6508;padding-top:3px;font-weight:700;color:#0f4c5c;font-size:11px}
.note{text-align:center;font-size:10px;color:#666;margin-top:8px}
</style></head><body><div class="page">
<div class="head">
  <div class="logo"><img src="${location.origin}/logo.png" alt="" onerror="this.style.display='none'"></div>
  <div class="title"><h1>নিউ প্রিন্টার্স</h1><div class="tag">আইটি সলিউশন এ্যান্ড ট্রেনিং সেন্টার</div><span class="pill">প্রোপ্রাইটর: মোঃ মিনহাজুল আবেদীন</span></div>
</div>
<div class="contact">📞 ০১৯৬৮৬৭৩২৪১, ০১৯৩৬০১১০৪৫ &nbsp;|&nbsp; ✉ newprintssmj@gmail.com<br>📍 সুন্দলপুর বাজার, মনিরামপুর, যশোর</div>
<div class="services">ব্যানার, পোস্টার, লিফলেট, ভিজিটিং কার্ড, আইডি কার্ড, ক্যাশ মেমো, মানি-রিসিট, প্যাড, লোগো, কালার আর্ট, প্রশিক্ষণ ও যাবতীয় ডিজিটাল সেবা</div>
<h2>${esc(title)}</h2>
<div class="meta"><div>তারিখ: <b>${esc(today)}</b></div>${customer.code ? `<div>কাস্টমার কোড: <b>${esc(customer.code)}</b></div>` : ''}</div>
<div class="field">ক্রেতার নাম: <span class="v">${esc(customer.name)}</span></div>
<div class="field">মোবাইল: <span class="v">${esc(customer.phone)}</span></div>
<table class="t"><thead><tr><th>#</th><th style="width:13%">তারিখ</th><th>বিবরণ</th><th style="width:14%">মোট টাকা</th><th style="width:14%">জমা</th><th style="width:14%">বাকী</th></tr></thead>
<tbody>${body}</tbody></table>
${payList}
<div class="bottom"><div class="sum">
  <div class="line"><span>মোট কাজ =</span><b>${t.count.toLocaleString('bn-BD')}টি</b></div>
  <div class="line"><span>মোট টাকা =</span><b>৳${bn(t.total)}</b></div>
  <div class="line"><span>মোট জমা =</span><b>৳${bn(t.paid)}</b></div>
  <div class="line due"><span>মোট বাকী =</span><b>৳${bn(t.due)}</b></div>
</div></div>
<div class="sigs"><div class="sig">ক্রেতার স্বাক্ষর</div><div class="sig">বিক্রেতার স্বাক্ষর</div></div>
<div class="note">অনুগ্রহ করে বাকি টাকা দ্রুত পরিশোধ করুন — ধন্যবাদ</div>
</div></body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}
