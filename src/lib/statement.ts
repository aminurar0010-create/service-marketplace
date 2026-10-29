import { format } from 'date-fns'
import { supabase } from './supabase'
import { normalizePhone } from './phone'
import { SHOP_NAME, SHOP_TAGLINE, SHOP_CONTACT } from './receipt'

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

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const taka = (n: number) => '৳' + Number(round2(n)).toLocaleString('bn-BD', { maximumFractionDigits: 2 })
const day = (iso: string) => format(new Date(iso), 'dd/MM/yyyy')

export function statementTotals(rows: StatementRow[]) {
  return {
    count: rows.length,
    total: round2(rows.reduce((a, r) => a + r.total, 0)),
    paid: round2(rows.reduce((a, r) => a + r.paid, 0)),
    due: round2(rows.reduce((a, r) => a + r.due, 0)),
  }
}

/** নির্বাচিত সারিগুলো A4 কাগজে প্রিন্ট (নতুন উইন্ডো → প্রিন্ট/Save as PDF) */
export function printStatement(customer: { name: string; phone: string; code?: string | null }, rows: StatementRow[]) {
  const win = window.open('', '_blank', 'width=900,height=800')
  if (!win) {
    alert('প্রিন্ট উইন্ডো খুলতে ব্যর্থ হয়েছে। পপ-আপ ব্লক করা থাকলে অনুমতি দিন।')
    return
  }
  const t = statementTotals(rows)

  const body = rows
    .map((r, i) => {
      const pays = r.payments
        .map((p) => `<div class="pay">${day(p.date)} — ${taka(p.amount)}${p.label ? ` (${esc(p.label.trim())})` : ''}</div>`)
        .join('')
      return `
      <tr>
        <td class="c">${(i + 1).toLocaleString('bn-BD')}</td>
        <td>${day(r.date)}</td>
        <td><strong>${esc(r.ref)}</strong><div class="pay">${esc(r.title)}</div>${pays}</td>
        <td class="r">${taka(r.total)}</td>
        <td class="r">${taka(r.paid)}</td>
        <td class="r due">${taka(r.due)}</td>
      </tr>`
    })
    .join('')

  win.document.write(`
    <html>
      <head>
        <title>বাকির বিবরণী — ${esc(customer.name)}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 14mm; }
          body { font-family: 'Noto Sans Bengali', Arial, sans-serif; color: #111; font-size: 13px; margin: 0; }
          .head { text-align: center; border-bottom: 2px solid #1F4D3D; padding-bottom: 8px; margin-bottom: 12px; }
          .head h1 { margin: 0 0 2px 0; font-size: 22px; color: #1F4D3D; }
          .head p { margin: 0; font-size: 11px; color: #555; }
          h2 { text-align: center; font-size: 16px; margin: 6px 0 10px 0; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 10px; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; }
          thead { display: table-header-group; }
          th { background: #EAF3EE; border: 1px solid #999; padding: 6px 5px; font-size: 12px; text-align: left; }
          td { border: 1px solid #bbb; padding: 5px; vertical-align: top; }
          tr { page-break-inside: avoid; }
          .c { text-align: center; width: 28px; }
          .r { text-align: right; white-space: nowrap; }
          .due { font-weight: bold; color: #b91c1c; }
          .pay { font-size: 10.5px; color: #555; margin-top: 2px; }
          .totals { margin-top: 12px; margin-left: auto; width: 55%; page-break-inside: avoid; }
          .totals td { border: none; padding: 3px 5px; }
          .totals .grand td { border-top: 2px solid #333; font-weight: bold; font-size: 15px; padding-top: 6px; }
          .footer { text-align: center; margin-top: 22px; font-size: 11px; color: #555; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="head">
          <h1>${SHOP_NAME}</h1>
          <p>${SHOP_TAGLINE}</p>
          <p>${SHOP_CONTACT}</p>
        </div>
        <h2>বাকির বিবরণী</h2>
        <div class="meta">
          <div>
            কাস্টমার: <strong>${esc(customer.name)}</strong><br/>
            ফোন: ${esc(customer.phone)}${customer.code ? ` • ${esc(customer.code)}` : ''}
          </div>
          <div style="text-align:right;">প্রিন্টের তারিখ: ${format(new Date(), 'dd/MM/yyyy')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="c">#</th><th>তারিখ</th><th>কাজের বিবরণ</th>
              <th style="text-align:right;">মোট টাকা</th><th style="text-align:right;">পেয়েছি</th><th style="text-align:right;">বাকি</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
        <table class="totals">
          <tr><td>মোট কাজ</td><td class="r">${t.count.toLocaleString('bn-BD')}টি</td></tr>
          <tr><td>মোট টাকা</td><td class="r">${taka(t.total)}</td></tr>
          <tr><td>মোট পেয়েছি</td><td class="r">${taka(t.paid)}</td></tr>
          <tr class="grand"><td>মোট বাকি</td><td class="r" style="color:#b91c1c;">${taka(t.due)}</td></tr>
        </table>
        <p class="footer">অনুগ্রহ করে বাকি টাকা দ্রুত পরিশোধ করুন। ধন্যবাদ।</p>
        <script>
          window.onload = function () { window.print(); };
        </script>
      </body>
    </html>
  `)
  win.document.close()
}
