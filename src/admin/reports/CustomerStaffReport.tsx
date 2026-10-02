import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase, ShopCustomerSummary, CustomerDue } from '../../lib/supabase'
import { taka, rangeDates, rangeIso, RangeKey, RANGE_LABELS, fetchAll, downloadCsv } from './reportUtils'

interface StaffRow {
  id: string
  name: string
  sales: number
  total: number
  paid: number
  due: number
  collected: number
}

/** Customer-wise ও Staff-wise Report */
export default function CustomerStaffReport() {
  const [range, setRange] = useState<RangeKey>('month')
  const [top, setTop] = useState<ShopCustomerSummary[]>([])
  const [dues, setDues] = useState<CustomerDue[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { from, to } = rangeDates(range)
  const { start, end } = rangeIso(from, to)

  // কাস্টমার অংশ (সর্বকালের) — একবারই
  useEffect(() => {
    ;(async () => {
      const [t, d] = await Promise.all([
        supabase.from('shop_customer_summary').select('*').order('total_spent', { ascending: false }).limit(15),
        supabase.from('customer_dues').select('*').order('total_due', { ascending: false }),
      ])
      if (t.error || d.error) console.error('কাস্টমার রিপোর্ট ত্রুটি:', t.error || d.error)
      setTop(((t.data as ShopCustomerSummary[]) || []).filter((c) => Number(c.total_spent) > 0))
      setDues((d.data as CustomerDue[]) || [])
    })()
  }, [])

  // স্টাফ অংশ — সময়সীমা অনুযায়ী
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [s, c, p] = await Promise.all([
          fetchAll<any>((a, b) =>
            supabase
              .from('pos_sales')
              .select('created_by, total_amount, paid_amount, due_amount')
              .eq('status', 'completed')
              .gte('created_at', start)
              .lt('created_at', end)
              .range(a, b)
          ),
          fetchAll<any>((a, b) =>
            supabase
              .from('sale_payments')
              .select('created_by, amount')
              .eq('kind', 'due_collection')
              .gte('created_at', start)
              .lt('created_at', end)
              .range(a, b)
          ),
          supabase.from('profiles').select('id, full_name'),
        ])
        setSales(s)
        setCollections(c)
        const map: Record<string, string> = {}
        ;((p.data as any[]) || []).forEach((r) => (map[r.id] = r.full_name))
        setNames(map)
      } catch (e) {
        console.error('স্টাফ রিপোর্ট ত্রুটি:', e)
        setError('স্টাফ রিপোর্ট লোড করা যায়নি')
      }
      setLoading(false)
    })()
  }, [start, end])

  const staffRows = useMemo<StaffRow[]>(() => {
    const map = new Map<string, StaffRow>()
    const get = (id: string | null) => {
      const key = id || 'unknown'
      if (!map.has(key)) map.set(key, { id: key, name: id ? names[id] || 'অজানা স্টাফ' : 'অজানা', sales: 0, total: 0, paid: 0, due: 0, collected: 0 })
      return map.get(key)!
    }
    sales.forEach((r) => {
      const x = get(r.created_by)
      x.sales += 1
      x.total += Number(r.total_amount)
      x.paid += Number(r.paid_amount)
      x.due += Number(r.due_amount)
    })
    collections.forEach((r) => (get(r.created_by).collected += Number(r.amount)))
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [sales, collections, names])

  const exportCsv = () =>
    downloadCsv(`customer-staff-report-${from}_${to}.csv`, [
      ['শীর্ষ কাস্টমার (সর্বকালের)'],
      ['কোড', 'নাম', 'ফোন', 'মোট খরচ', 'বকেয়া'],
      ...top.map((c) => [c.customer_code, c.name, c.phone, c.total_spent, c.total_due]),
      [],
      ['বকেয়া তালিকা'],
      ['কোড', 'নাম', 'ফোন', 'বকেয়া'],
      ...dues.map((d) => [d.customer_code, d.name, d.phone, d.total_due]),
      [],
      [`স্টাফ-ভিত্তিক (${from} থেকে ${to})`],
      ['স্টাফ', 'বিক্রি', 'মোট বিল', 'পেইড', 'বাকি', 'বাকি আদায়'],
      ...staffRows.map((r) => [r.name, r.sales, r.total, r.paid, r.due, r.collected]),
    ])

  const th = 'py-2 pr-4 text-left font-semibold text-gray-600'
  const totalDue = dues.reduce((a, d) => a + Number(d.total_due), 0)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold">কার কাছে কত বকেয়া — মোট {taka(totalDue)}</h3>
          <button onClick={exportCsv} className="flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600">
            <Download size={16} /> CSV (সব)
          </button>
        </div>
        {dues.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">কোনো বকেয়া নেই 🎉</p>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className={th}>কাস্টমার</th>
                  <th className={th}>ফোন</th>
                  <th className={th}>ইনভয়েস</th>
                  <th className={th}>বকেয়া</th>
                </tr>
              </thead>
              <tbody>
                {dues.map((d) => (
                  <tr key={d.customer_id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium">{d.name}</td>
                    <td className="py-2 pr-4 text-gray-500">{d.phone}</td>
                    <td className="py-2 pr-4 text-gray-500">{d.due_sales_count}টি</td>
                    <td className="py-2 pr-4 font-bold text-red-600">{taka(d.total_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold mb-3">শীর্ষ কাস্টমার (সর্বকালের মোট খরচ অনুযায়ী)</h3>
        {top.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">এখনো কোনো তথ্য নেই</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className={th}>#</th>
                  <th className={th}>কাস্টমার</th>
                  <th className={th}>ভিজিট</th>
                  <th className={th}>মোট খরচ</th>
                  <th className={th}>বকেয়া</th>
                </tr>
              </thead>
              <tbody>
                {top.map((c, i) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-400">{i + 1}</td>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{c.name}</span>
                      <span className="block text-xs text-gray-500">
                        {c.phone} • {c.customer_code}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{c.total_visits}</td>
                    <td className="py-2 pr-4 font-semibold">{taka(c.total_spent)}</td>
                    <td className={`py-2 pr-4 ${Number(c.total_due) > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{taka(c.total_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold">স্টাফ-ভিত্তিক বিক্রি (POS)</h3>
          <div className="flex gap-2">
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={`px-3 py-1 rounded text-sm border transition ${
                  range === k ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {RANGE_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 py-4 text-center">লোড করছি...</p>
        ) : error ? (
          <p className="text-sm text-red-600 py-4 text-center">{error}</p>
        ) : staffRows.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">এই সময়ে কোনো বিক্রি নেই</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className={th}>স্টাফ</th>
                  <th className={th}>বিক্রি</th>
                  <th className={th}>মোট বিল</th>
                  <th className={th}>পেইড</th>
                  <th className={th}>বাকি</th>
                  <th className={th}>বাকি আদায়</th>
                </tr>
              </thead>
              <tbody>
                {staffRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium">{r.name}</td>
                    <td className="py-2 pr-4">{r.sales}</td>
                    <td className="py-2 pr-4 font-semibold">{taka(r.total)}</td>
                    <td className="py-2 pr-4 text-green-700">{taka(r.paid)}</td>
                    <td className="py-2 pr-4 text-red-600">{taka(r.due)}</td>
                    <td className="py-2 pr-4 text-indigo-700">{taka(r.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">* {from} থেকে {to}। স্টাফ = যিনি বিক্রি/আদায় এন্ট্রি করেছেন (`created_by`)।</p>
      </div>
    </div>
  )
}
