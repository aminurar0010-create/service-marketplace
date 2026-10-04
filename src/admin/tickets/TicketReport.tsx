import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { downloadCsv } from '../reports/reportUtils'
import { TicketRow, TYPE_LABEL, money, profitOf, todayDhaka } from './ticketUtils'

/** টিকিটের মাসিক লাভ — ধরন ও প্ল্যাটফর্ম ধরে */
export default function TicketReport({ tickets }: { tickets: TicketRow[] }) {
  const [month, setMonth] = useState(todayDhaka().slice(0, 7))
  const months = useMemo(() => [...new Set([todayDhaka().slice(0, 7), ...tickets.map((t) => t.travel_date.slice(0, 7))])].sort().reverse(), [tickets])
  const rows = useMemo(() => tickets.filter((t) => t.travel_date.startsWith(month) && ['booked', 'delivered', 'cancelled'].includes(t.status) && (t.cost_price != null)), [tickets, month])
  const sum = (arr: TicketRow[], f: (t: TicketRow) => number) => arr.reduce((a, t) => a + f(t), 0)
  const live = rows.filter((t) => t.status !== 'cancelled')
  const group = (key: (t: TicketRow) => string) => {
    const m = new Map<string, { n: number; sell: number; cost: number; profit: number }>()
    rows.forEach((t) => {
      const k = key(t), v = m.get(k) || { n: 0, sell: 0, cost: 0, profit: 0 }
      v.n += t.status === 'cancelled' ? 0 : 1; v.sell += t.status === 'cancelled' ? 0 : Number(t.sell_price || 0); v.cost += Number(t.cost_price || 0) - (t.status === 'cancelled' ? Number(t.platform_refund || 0) : 0); v.profit += profitOf(t)
      m.set(k, v)
    })
    return [...m.entries()].sort((a, b) => b[1].profit - a[1].profit)
  }
  const byType = group((t) => TYPE_LABEL[t.ticket_type]), byPlat = group((t) => t.platform || 'অজানা')
  const exportCsv = () => downloadCsv(`ticket-report-${month}.csv`, [['অনুরোধ নং', 'ধরন', 'রুট', 'যাত্রা', 'স্ট্যাটাস', 'প্ল্যাটফর্ম', 'বিক্রি', 'কেনা', 'লাভ'], ...rows.map((t) => [t.request_no, TYPE_LABEL[t.ticket_type], `${t.from_place}→${t.to_place}`, t.travel_date, t.status, t.platform || '', t.sell_price || 0, t.cost_price || 0, profitOf(t)])])
  const table = (title: string, data: [string, { n: number; sell: number; cost: number; profit: number }][]) => (
    <div><p className="font-semibold text-sm mb-1">{title}</p>
      <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-3 py-1.5 text-left">নাম</th><th className="px-3 py-1.5 text-right">টিকিট</th><th className="px-3 py-1.5 text-right">বিক্রি</th><th className="px-3 py-1.5 text-right">কেনা</th><th className="px-3 py-1.5 text-right">লাভ</th></tr></thead>
        <tbody>{data.map(([k, v]) => <tr key={k} className="border-b border-gray-100"><td className="px-3 py-1.5">{k}</td><td className="px-3 py-1.5 text-right">{v.n}</td><td className="px-3 py-1.5 text-right">{money(v.sell)}</td><td className="px-3 py-1.5 text-right">{money(v.cost)}</td><td className={`px-3 py-1.5 text-right font-semibold ${v.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{money(v.profit)}</td></tr>)}</tbody></table></div>
  )
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none">{months.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        <button onClick={exportCsv} disabled={rows.length === 0} className="ml-auto flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 disabled:opacity-40"><Download size={16} /> CSV</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['টিকিট (বাতিল বাদে)', String(live.length), 'bg-gray-50', ''], ['বিক্রি', money(sum(live, (t) => Number(t.sell_price || 0))), 'bg-gray-50', ''], ['কেনা (নিট)', money(sum(rows, (t) => Number(t.cost_price || 0) - (t.status === 'cancelled' ? Number(t.platform_refund || 0) : 0))), 'bg-orange-50', 'text-orange-700'], ['নিট লাভ', money(sum(rows, profitOf)), 'bg-green-50', 'text-green-700']].map(([l, v, bg, tx]) => <div key={l} className={`${bg} rounded-lg p-3`}><p className="text-xs text-gray-500">{l}</p><p className={`text-lg font-bold ${tx}`}>{v}</p></div>)}
      </div>
      {rows.length === 0 ? <p className="text-center text-gray-500 py-6 text-sm">এই মাসে কোনো বুক-করা টিকিট নেই (যাত্রার তারিখ ধরে)</p> : <div className="grid md:grid-cols-2 gap-6">{table('ধরন অনুযায়ী', byType)}{table('প্ল্যাটফর্ম অনুযায়ী', byPlat)}</div>}
      <p className="text-xs text-gray-400">* মাস = যাত্রার তারিখ। বাতিল টিকিটে নিট = প্ল্যাটফর্ম থেকে ফেরত − কেনা। এই মাসের সব টাকার হিসাব ক্যাশ-বুকেও আছে।</p>
    </div>
  )
}
