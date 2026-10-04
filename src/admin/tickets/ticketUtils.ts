export type TicketType = 'bus' | 'train' | 'air'
export type TicketStatus = 'requested' | 'booked' | 'delivered' | 'cancelled'

export interface TicketRow {
  id: string
  request_no: string
  ticket_type: TicketType
  from_place: string
  to_place: string
  travel_date: string
  travel_time: string | null
  passengers: string | null
  passenger_count: number
  shop_customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  note: string | null
  source: 'counter' | 'web'
  status: TicketStatus
  platform: string | null
  ticket_ref: string | null
  fare: number | null
  service_charge: number | null
  sell_price: number | null
  cost_price: number | null
  platform_refund: number
  sale_id: string | null
  cancel_reason: string | null
  created_at: string
}

export const TYPE_LABEL: Record<TicketType, string> = { bus: 'বাস', train: 'ট্রেন', air: 'বিমান' }
export const TYPE_ICON: Record<TicketType, string> = { bus: '🚌', train: '🚆', air: '✈️' }
export const STATUS_LABEL: Record<TicketStatus, string> = { requested: 'অনুরোধ', booked: 'বুক হয়েছে', delivered: 'ডেলিভারি', cancelled: 'বাতিল' }

export const money = (n: number | null | undefined) => '৳' + Number(n || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })
export const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

/** লাভ: বিক্রি − কেনা; বাতিলে: প্ল্যাটফর্ম থেকে ফেরত − কেনা (ক্ষতি হলে ঋণাত্মক) */
export const profitOf = (t: TicketRow) =>
  t.status === 'cancelled' ? Number(t.platform_refund || 0) - Number(t.cost_price || 0) : t.status === 'requested' ? 0 : Number(t.sell_price || 0) - Number(t.cost_price || 0)

/** WhatsApp লিংক (বাংলাদেশি নম্বর) — মেসেজ আপনি নিজে Send চাপেন */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.length < 10) return null
  const num = d.startsWith('880') ? d : d.startsWith('0') ? '88' + d : '880' + d
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}

export const ticketMessage = (t: TicketRow) =>
  `আসসালামু আলাইকুম ${t.customer_name || ''}, আপনার ${TYPE_LABEL[t.ticket_type]} টিকিট প্রস্তুত।\n` +
  `${t.from_place} → ${t.to_place}, ${new Date(t.travel_date).toLocaleDateString('bn-BD')}${t.travel_time ? ' ' + t.travel_time : ''}\n` +
  `টিকিট নং: ${t.ticket_ref || '—'}\n— নিউ প্রিন্টার্স`

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** টিকিট স্লিপ প্রিন্ট (A5) */
export function printTicketSlip(t: TicketRow) {
  const w = window.open('', '_blank', 'width=620,height=800')
  if (!w) return alert('প্রিন্ট উইন্ডো খুলতে ব্যর্থ। পপ-আপের অনুমতি দিন।')
  const row = (k: string, v: string) => `<tr><th>${k}</th><td>${v}</td></tr>`
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>টিকিট ${esc(t.request_no)}</title><style>
@page{size:A5 portrait;margin:0}*{box-sizing:border-box}body{margin:0;font-family:'Noto Sans Bengali','Kalpurush',sans-serif;color:#17323b;font-size:13px}
.page{width:148mm;min-height:210mm;padding:8mm;background:#fbf7ea}.head{text-align:center;border-bottom:2px solid #b8860b;padding-bottom:6px}
h1{margin:0;font-size:24px;color:#0f4c5c}.tag{font-size:12px;font-weight:700;color:#8a6508}.c{font-size:10.5px;margin-top:4px}
h2{text-align:center;color:#0f4c5c;font-size:17px;margin:10px 0}.route{text-align:center;font-size:20px;font-weight:700;margin:6px 0}
table{width:100%;border-collapse:collapse;margin-top:8px}th{width:34%;text-align:left;background:#e8f1f3;padding:5px 8px;border:1px solid #9bb3b9}td{padding:5px 8px;border:1px solid #9bb3b9}
.n{margin-top:14px;font-size:11px;color:#555}.sig{margin-top:30px;width:45%;margin-left:auto;text-align:center;border-top:1px solid #8a6508;padding-top:3px;font-weight:700;font-size:11px}
</style></head><body><div class="page"><div class="head"><h1>নিউ প্রিন্টার্স</h1><div class="tag">আইটি সলিউশন এ্যান্ড ট্রেনিং সেন্টার</div>
<div class="c">📞 ০১৯৬৮৬৭৩২৪১, ০১৯৩৬০১১০৪৫ | 📍 সুন্দলপুর বাজার, মনিরামপুর, যশোর</div></div>
<h2>${esc(TYPE_LABEL[t.ticket_type])} টিকিট</h2><div class="route">${esc(t.from_place)} → ${esc(t.to_place)}</div>
<table>${row('অনুরোধ নং', esc(t.request_no))}${row('টিকিট/PNR নং', esc(t.ticket_ref || '—'))}
${row('যাত্রার তারিখ', esc(new Date(t.travel_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })) + (t.travel_time ? ' • ' + esc(t.travel_time) : ''))}
${row('যাত্রী', esc(t.passengers || t.customer_name || '—').replace(/\n/g, '<br>') + ` (${t.passenger_count} জন)`)}
${row('ভাড়া', money(t.fare))}${Number(t.service_charge) > 0 ? row('সার্ভিস চার্জ', money(t.service_charge)) : ''}${row('মোট', `<b>${money(t.sell_price)}</b>`)}</table>
<div class="n">যাত্রার আগে নাম, তারিখ ও সময় মিলিয়ে নিন। টিকিট বাতিল/ফেরতের নিয়ম পরিবহন কর্তৃপক্ষের নীতি অনুযায়ী।</div><div class="sig">অনুমোদিত স্বাক্ষর</div></div></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 500)
}
