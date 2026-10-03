import { QuoteItemRow, QuoteRow, money } from './pricingUtils'

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const bn = (n: number) => Number(n || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })
const day = (d: string) => new Date(d).toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' })

/** কোটেশন প্রিন্ট (A5, মেমোর ডিজাইনে) */
export function printQuote(q: QuoteRow, items: QuoteItemRow[]) {
  const w = window.open('', '_blank', 'width=620,height=900')
  if (!w) return alert('প্রিন্ট উইন্ডো খুলতে ব্যর্থ। পপ-আপের অনুমতি দিন।')
  const rows = items.map((i, n) => `<tr><td class="c">${bn(n + 1)}</td><td>${esc(i.description)}${i.detail ? `<div class="dt">${esc(i.detail)}</div>` : ''}</td><td class="c">${bn(i.quantity)}</td><td class="r">${bn(i.unit_price)}</td><td class="r">${bn(i.line_total)}</td></tr>`).join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>কোটেশন ${esc(q.quote_no)}</title><style>
@page{size:A5 portrait;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans Bengali','Kalpurush',sans-serif;color:#17323b;font-size:12px}
.page{width:148mm;min-height:210mm;padding:7mm;background:#fbf7ea}
.head{display:flex;gap:10px;align-items:center;border-bottom:2px solid #b8860b;padding-bottom:6px}
.logo{width:56px;height:56px;border-radius:10px;background:#0f4c5c;overflow:hidden;flex-shrink:0}.logo img{width:100%;height:100%;object-fit:contain}
.title{flex:1;text-align:center}.title h1{margin:0;font-size:24px;color:#0f4c5c}.tag{font-size:11.5px;font-weight:700;color:#8a6508}
.contact{font-size:10.5px;text-align:center;margin:5px 0 8px;line-height:1.5}
h2{margin:6px 0;text-align:center;font-size:16px;color:#0f4c5c;letter-spacing:1px}
.meta{display:flex;justify-content:space-between;margin:3px 0}
table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#0f4c5c;color:#fff;padding:4px;border:1px solid #0f4c5c}
td{border:1px solid #9bb3b9;padding:3px 5px}.c{text-align:center}.r{text-align:right}.dt{font-size:10px;color:#5b6f6a}
.sum{width:50%;margin:8px 0 0 auto}.line{display:flex;justify-content:space-between;border:1px solid #0f4c5c;margin-bottom:3px;padding:3px 8px;background:#e8f1f3}
.note{margin-top:10px;font-size:11px}.foot{margin-top:18px;font-size:10px;color:#666;text-align:center}
.sig{margin-top:28px;width:42%;margin-left:auto;text-align:center;border-top:1px solid #8a6508;padding-top:3px;font-weight:700;color:#0f4c5c;font-size:11px}
</style></head><body><div class="page">
<div class="head"><div class="logo"><img src="${location.origin}/logo.png" alt="" onerror="this.style.display='none'"></div>
<div class="title"><h1>নিউ প্রিন্টার্স</h1><div class="tag">আইটি সলিউশন এ্যান্ড ট্রেনিং সেন্টার</div></div></div>
<div class="contact">📞 ০১৯৬৮৬৭৩২৪১, ০১৯৩৬০১১০৪৫ &nbsp;|&nbsp; ✉ newprintssmj@gmail.com<br>📍 সুন্দলপুর বাজার, মনিরামপুর, যশোর</div>
<h2>কোটেশন / মূল্য প্রস্তাব</h2>
<div class="meta"><div>কোটেশন নং: <b>${esc(q.quote_no)}</b></div><div>তারিখ: <b>${esc(day(q.created_at))}</b></div></div>
<div class="meta"><div>প্রাপক: <b>${esc(q.customer_name || '—')}</b>${q.customer_phone ? ` (${esc(q.customer_phone)})` : ''}</div>${q.valid_until ? `<div>মেয়াদ: <b>${esc(day(q.valid_until))}</b> পর্যন্ত</div>` : ''}</div>
<table><thead><tr><th style="width:8%">#</th><th>বিবরণ</th><th style="width:12%">পরিমাণ</th><th style="width:16%">দর</th><th style="width:18%">টাকা</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum"><div class="line"><span>উপমোট</span><b>${money(q.subtotal)}</b></div>${q.discount > 0 ? `<div class="line"><span>ছাড়</span><b>− ${money(q.discount)}</b></div>` : ''}<div class="line"><span><b>সর্বমোট</b></span><b>${money(q.total)}</b></div></div>
${q.note ? `<div class="note"><b>নোট:</b> ${esc(q.note)}</div>` : ''}
<div class="sig">অনুমোদিত স্বাক্ষর</div>
<div class="foot">এটি মূল্য প্রস্তাব, বিল নয়। উল্লিখিত মেয়াদ পর্যন্ত দাম প্রযোজ্য।</div>
</div></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 500)
}
