import { POSSale, POSSaleItem, SalePayment } from './supabase'

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const bn = (n: number) => Number(n || 0).toLocaleString('bn-BD')

const MIN_ROWS = 9 // ছাপা মেমোর মতো ফাঁকা ঘরসহ কমপক্ষে এতগুলো লাইন

/**
 * নিউ প্রিন্টার্সের মেমো ডিজাইন (A5) — POS বিক্রয় থেকে অটো ভরা।
 * ছবি নয়, ভেক্টর HTML/CSS — তাই যেকোনো প্রিন্টারে ঝকঝকে আসে।
 */
export function printMemo(sale: POSSale, items: POSSaleItem[], payments: SalePayment[] = [], customerAddress = '') {
  const win = window.open('', '_blank', 'width=620,height=900')
  if (!win) {
    alert('প্রিন্ট উইন্ডো খুলতে ব্যর্থ হয়েছে। পপ-আপ ব্লক করা থাকলে অনুমতি দিন।')
    return
  }
  const paid = sale.paid_amount ?? sale.total_amount
  const due = sale.due_amount ?? 0
  const date = new Date(sale.created_at).toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' })
  const rows = items
    .map((i) => `<tr><td>${esc(i.item_name)}</td><td class="c">${bn(i.quantity)}</td><td class="r">${bn(i.unit_price)}</td><td class="r">${bn(i.line_total)}</td></tr>`)
    .join('')
  const blanks = Array.from({ length: Math.max(0, MIN_ROWS - items.length) }, () => '<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td></tr>').join('')
  const discount = Number(sale.discount_amount) > 0 ? `<div class="line"><span>ছাড়</span><b>− ৳${bn(sale.discount_amount)}</b></div>` : ''
  const methods = payments.length ? payments.map((p) => p.method).filter((m, i, a) => a.indexOf(m) === i).length : 0

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>মেমো ${esc(sale.invoice_no || sale.sale_number)}</title>
<style>
@page{size:A5 portrait;margin:0}
*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans Bengali','Kalpurush',sans-serif;color:#17323b;font-size:12px}
.page{width:148mm;min-height:210mm;padding:7mm 7mm 6mm;background:#fbf7ea;position:relative}
.head{display:flex;gap:10px;align-items:center;border-bottom:2px solid #b8860b;padding-bottom:6px}
.logo{width:64px;height:64px;border-radius:12px;background:#0f4c5c;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.logo img{width:100%;height:100%;object-fit:contain}
.title{flex:1;text-align:center}
.title h1{margin:0;font-size:26px;color:#0f4c5c;line-height:1.1}
.title .tag{font-size:12px;font-weight:700;color:#8a6508}
.pill{display:inline-block;margin-top:3px;background:#0f4c5c;color:#fff;border-radius:4px;padding:1px 10px;font-size:11px}
.contact{font-size:10.5px;text-align:center;margin:5px 0 2px;line-height:1.5}
.services{font-size:9.5px;text-align:center;color:#444;border-top:1px solid #b8860b;border-bottom:1px solid #b8860b;padding:3px 0;margin:4px 0 8px}
.meta{display:flex;justify-content:space-between;margin:3px 0}
.field{margin:5px 0;display:flex;gap:4px}
.field span.v{flex:1;border-bottom:1px dotted #555;min-height:15px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#0f4c5c;color:#fff;font-weight:600;padding:4px;border:1px solid #0f4c5c}
td{border:1px solid #9bb3b9;padding:3px 5px;height:19px}
.c{text-align:center}.r{text-align:right}
.bottom{display:flex;justify-content:space-between;gap:10px;margin-top:8px}
.words{flex:1;font-size:11px;padding-top:4px}
.sum{width:46%}
.line{display:flex;justify-content:space-between;border:1px solid #0f4c5c;margin-bottom:3px;padding:3px 8px;background:#e8f1f3}
.line.due b{color:#b00020}
.sigs{display:flex;justify-content:space-between;margin-top:26px}
.sig{width:42%;text-align:center;border-top:1px solid #8a6508;padding-top:3px;font-weight:700;color:#0f4c5c;font-size:11px}
.note{text-align:center;font-size:9.5px;color:#666;margin-top:8px}
</style></head><body><div class="page">
<div class="head">
  <div class="logo"><img src="${location.origin}/logo.png" alt="" onerror="this.style.display='none'"></div>
  <div class="title"><h1>নিউ প্রিন্টার্স</h1><div class="tag">আইটি সলিউশন এ্যান্ড ট্রেনিং সেন্টার</div><span class="pill">প্রোপ্রাইটর: মোঃ মাসুদুর রহমান</span></div>
</div>
<div class="contact">📞 ০১৯৬৮৬৭৩২৪১, ০১৯৩৬০১১০৪৫ &nbsp;|&nbsp; ✉ newprintssmj@gmail.com<br>📍 সুন্দলপুর বাজার, মনিরামপুর, যশোর</div>
<div class="services">ব্যানার, পোস্টার, লিফলেট, ভিজিটিং কার্ড, আইডি কার্ড, ক্যাশ মেমো, মানি-রিসিট, প্যাড, লোগো, কালার আর্ট, প্রশিক্ষণ ও যাবতীয় ডিজিটাল সেবা</div>
<div class="meta"><div>তারিখ: <b>${esc(date)}</b></div><div>ক্রমিক নং: <b>${esc(sale.invoice_no || sale.sale_number)}</b></div></div>
<div class="field">ক্রেতার নাম: <span class="v">${esc(sale.customer_name || '')}${sale.customer_phone ? ` (${esc(sale.customer_phone)})` : ''}</span></div>
<div class="field">ক্রেতার ঠিকানা: <span class="v">${esc(customerAddress)}</span></div>
<table><thead><tr><th style="width:52%">বিবরণ</th><th style="width:14%">পরিমাণ</th><th style="width:16%">দর</th><th style="width:18%">টাকা</th></tr></thead>
<tbody>${rows}${blanks}</tbody></table>
<div class="bottom">
  <div class="words">কথায়: ..............................................${methods > 1 ? '<br><small>(একাধিক মাধ্যমে পরিশোধ)</small>' : ''}</div>
  <div class="sum">${discount}
    <div class="line"><span>মোট =</span><b>৳${bn(sale.total_amount)}</b></div>
    <div class="line"><span>জমা =</span><b>৳${bn(paid)}</b></div>
    <div class="line due"><span>বাকী =</span><b>৳${bn(due)}</b></div>
  </div>
</div>
<div class="sigs"><div class="sig">ক্রেতার স্বাক্ষর</div><div class="sig">বিক্রেতার স্বাক্ষর</div></div>
<div class="note">ধন্যবাদ — আবার আসবেন</div>
</div></body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}
