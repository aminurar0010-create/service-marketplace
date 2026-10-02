import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase, Order, Service } from '../../lib/supabase'
import { taka, rangeDates, rangeIso, RangeKey, RANGE_LABELS, fetchAll, downloadCsv } from './reportUtils'

interface Row {
  name: string
  posQty: number
  onlineQty: number
  qty: number
  revenue: number
}

/** Service-wise Report — Quantity ও Revenue (POS + অনলাইন অর্ডার), বার চার্টসহ */
export default function ServiceReport({ services, orders }: { services: Service[]; orders: Order[] }) {
  const [range, setRange] = useState<RangeKey>('month')
  const [items, setItems] = useState<{ item_name: string; quantity: number; line_total: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<'revenue' | 'qty'>('revenue')

  const { from, to } = rangeDates(range)
  const { start, end } = rangeIso(from, to)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchAll<any>((a, b) =>
          supabase
            .from('pos_sale_items')
            .select('item_name, quantity, line_total, pos_sales!inner(created_at, status)')
            .eq('pos_sales.status', 'completed')
            .gte('pos_sales.created_at', start)
            .lt('pos_sales.created_at', end)
            .range(a, b)
        )
        setItems(data)
      } catch (e) {
        console.error('সার্ভিস রিপোর্ট ত্রুটি:', e)
        setError('রিপোর্ট লোড করা যায়নি')
      }
      setLoading(false)
    })()
  }, [start, end])

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>()
    const get = (name: string) => {
      if (!map.has(name)) map.set(name, { name, posQty: 0, onlineQty: 0, qty: 0, revenue: 0 })
      return map.get(name)!
    }
    items.forEach((i) => {
      const r = get(i.item_name)
      r.posQty += Number(i.quantity)
      r.qty += Number(i.quantity)
      r.revenue += Number(i.line_total)
    })
    const s = new Date(start).getTime()
    const e = new Date(end).getTime()
    orders.forEach((o) => {
      const t = new Date(o.created_at).getTime()
      if (t < s || t >= e || ['cancelled', 'rejected'].includes(o.status) || o.payment_status === 'refunded') return
      const r = get(services.find((x) => x.id === o.service_id)?.name || o.service_name || 'অজানা সার্ভিস')
      r.onlineQty += 1
      r.qty += 1
      r.revenue += Number(o.total_amount)
    })
    return [...map.values()].sort((a, b) => (sortBy === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty))
  }, [items, orders, services, start, end, sortBy])

  const maxRev = Math.max(1, ...rows.map((r) => r.revenue))
  const totalRev = rows.reduce((a, r) => a + r.revenue, 0)
  const totalQty = rows.reduce((a, r) => a + r.qty, 0)

  const exportCsv = () =>
    downloadCsv(`service-report-${from}_${to}.csv`, [
      ['সার্ভিস/পণ্য', 'POS পরিমাণ', 'অনলাইন অর্ডার', 'মোট পরিমাণ', 'রেভিনিউ'],
      ...rows.map((r) => [r.name, r.posQty, r.onlineQty, r.qty, r.revenue]),
      ['মোট', '', '', totalQty, totalRev],
    ])

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={`px-3 py-1.5 rounded text-sm border transition ${
                range === k ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {RANGE_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'revenue' | 'qty')}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm outline-none"
          >
            <option value="revenue">রেভিনিউ অনুযায়ী</option>
            <option value="qty">পরিমাণ অনুযায়ী</option>
          </select>
          <button onClick={exportCsv} disabled={rows.length === 0} className="flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 disabled:opacity-40">
            <Download size={16} /> CSV
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {from} থেকে {to} • মোট পরিমাণ {totalQty} • মোট রেভিনিউ {taka(totalRev)} (বাকিসহ বিলের অঙ্ক; বাতিল/ফেরত বাদ)
      </p>

      {loading ? (
        <p className="text-sm text-gray-500 py-6 text-center">লোড করছি...</p>
      ) : error ? (
        <p className="text-sm text-red-600 py-6 text-center">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">এই সময়ে কোনো বিক্রি নেই</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.name}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-800">{r.name}</span>
                <span className="text-gray-600">
                  {r.qty} টি • <b>{taka(r.revenue)}</b>
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${(r.revenue / maxRev) * 100}%` }} />
              </div>
              <p className="text-[11px] text-gray-400">
                POS {r.posQty} • অনলাইন {r.onlineQty}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
