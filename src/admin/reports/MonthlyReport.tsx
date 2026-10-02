import { useEffect, useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { supabase, CashTransaction, Order } from '../../lib/supabase'
import { taka, todayDhaka, monthBounds, rangeIso, fetchAll, downloadCsv, printReport } from './reportUtils'

/** Monthly Report — আয়-ব্যয়, লাভ/ক্ষতি, দিনভিত্তিক তালিকা, ক্যাটাগরি, CSV */
export default function MonthlyReport({ orders }: { orders: Order[] }) {
  const [month, setMonth] = useState(todayDhaka().slice(0, 7))
  const [tx, setTx] = useState<CashTransaction[]>([])
  const [posSales, setPosSales] = useState<{ total_amount: number; paid_amount: number; due_amount: number }[]>([])
  const [bookedOrderIds, setBookedOrderIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { from, to } = monthBounds(month)

  const months = useMemo(() => {
    const set = new Set<string>([todayDhaka().slice(0, 7), month])
    orders.forEach((o) => set.add(new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).slice(0, 7)))
    return [...set].sort().reverse()
  }, [orders, month])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      const { start, end } = rangeIso(from, to)
      try {
        const [t, s, b] = await Promise.all([
          fetchAll<CashTransaction>((a, z) =>
            supabase.from('cash_transactions').select('*').gte('entry_date', from).lte('entry_date', to).order('entry_date').range(a, z)
          ),
          fetchAll<any>((a, z) =>
            supabase.from('pos_sales').select('total_amount, paid_amount, due_amount').eq('status', 'completed').gte('created_at', start).lt('created_at', end).range(a, z)
          ),
          fetchAll<any>((a, z) =>
            supabase.from('cash_transactions').select('order_id').eq('type', 'income').not('order_id', 'is', null).range(a, z)
          ),
        ])
        setTx(t)
        setPosSales(s)
        setBookedOrderIds(new Set(b.map((r: any) => r.order_id)))
      } catch (e) {
        console.error('মান্থলি রিপোর্ট ত্রুটি:', e)
        setError('রিপোর্ট লোড করা যায়নি')
      }
      setLoading(false)
    })()
  }, [from, to])

  const r = useMemo(() => {
    const income = tx.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const expense = tx.filter((t) => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
    // ফেজ C-র আগের পেইড অনলাইন অর্ডার, যেগুলো ক্যাশ-বুকে নেই — দ্বিগুণ গোনা এড়াতে শুধু সেগুলোই যোগ হয়
    const legacyOrders = orders
      .filter(
        (o) =>
          o.payment_status === 'paid' &&
          !bookedOrderIds.has(o.id) &&
          new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).slice(0, 7) === month
      )
      .reduce((a, o) => a + Number(o.total_amount), 0)
    const byDay = new Map<string, { income: number; expense: number }>()
    const incomeCat: Record<string, number> = {}
    const expenseCat: Record<string, number> = {}
    tx.forEach((t) => {
      const d = byDay.get(t.entry_date) || { income: 0, expense: 0 }
      d[t.type] += Number(t.amount)
      byDay.set(t.entry_date, d)
      const cat = t.type === 'income' ? incomeCat : expenseCat
      cat[t.category] = (cat[t.category] || 0) + Number(t.amount)
    })
    return {
      income,
      expense,
      legacyOrders,
      net: income + legacyOrders - expense,
      days: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      incomeCat: Object.entries(incomeCat).sort((a, b) => b[1] - a[1]),
      expenseCat: Object.entries(expenseCat).sort((a, b) => b[1] - a[1]),
      posTotal: posSales.reduce((a, s) => a + Number(s.total_amount), 0),
      posPaid: posSales.reduce((a, s) => a + Number(s.paid_amount), 0),
      posDue: posSales.reduce((a, s) => a + Number(s.due_amount), 0),
    }
  }, [tx, posSales, orders, bookedOrderIds, month])

  const summaryRows = (): string[][] => [
    ['বিষয়', 'পরিমাণ'],
    ['ক্যাশ-বুক আয়', taka(r.income)],
    ['ক্যাশ-বুকে নেই এমন পেইড অর্ডার', taka(r.legacyOrders)],
    ['মোট ব্যয়', taka(r.expense)],
    ['নিট লাভ/ক্ষতি', taka(r.net)],
    ['POS বিক্রি (বিল)', taka(r.posTotal)],
    ['POS পেইড', taka(r.posPaid)],
    ['POS এখনো বাকি', taka(r.posDue)],
  ]

  const exportCsv = () =>
    downloadCsv(`monthly-report-${month}.csv`, [
      [`মান্থলি রিপোর্ট ${month}`],
      ...summaryRows(),
      [],
      ['দিনভিত্তিক'],
      ['তারিখ', 'আয়', 'ব্যয়', 'নিট'],
      ...r.days.map(([d, v]) => [d, v.income, v.expense, v.income - v.expense]),
      [],
      ['ক্যাশ-বুক এন্ট্রি'],
      ['তারিখ', 'ধরন', 'ক্যাটাগরি', 'মাধ্যম', 'বিস্তারিত', 'পরিমাণ'],
      ...tx.map((t) => [t.entry_date, t.type === 'income' ? 'আয়' : 'ব্যয়', t.category, t.payment_method || '', t.description || '', t.amount]),
    ])

  const print = () =>
    printReport('মান্থলি রিপোর্ট', month, [
      { heading: 'সারসংক্ষেপ', rows: summaryRows() },
      { heading: 'আয়ের ক্যাটাগরি', rows: [['ক্যাটাগরি', 'পরিমাণ'], ...r.incomeCat.map(([c, a]) => [c, taka(a)])] },
      { heading: 'ব্যয়ের ক্যাটাগরি', rows: [['ক্যাটাগরি', 'পরিমাণ'], ...r.expenseCat.map(([c, a]) => [c, taka(a)])] },
      { heading: 'দিনভিত্তিক', rows: [['তারিখ', 'আয়', 'ব্যয়', 'নিট'], ...r.days.map(([d, v]) => [d, taka(v.income), taka(v.expense), taka(v.income - v.expense)])] },
    ])

  const box = (label: string, value: string, tone: string, text = 'text-gray-800') => (
    <div className={`${tone} rounded-lg p-4`}>
      <p className="text-xs text-gray-500 font-semibold">{label}</p>
      <p className={`text-xl font-bold mt-1 ${text}`}>{value}</p>
    </div>
  )
  const catList = (title: string, list: [string, number][], tone: string) => (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p>
      {list.length === 0 ? (
        <p className="text-xs text-gray-400">কিছু নেই</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map(([c, a]) => (
            <span key={c} className={`${tone} rounded-lg px-3 py-1.5 text-sm`}>
              {c}: <b>{taka(a)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-4">
          <button onClick={print} disabled={loading} className="flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 disabled:opacity-40">
            <Printer size={16} /> প্রিন্ট
          </button>
          <button onClick={exportCsv} disabled={loading} className="flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 disabled:opacity-40">
            <Download size={16} /> CSV
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-6 text-center">লোড করছি...</p>
      ) : error ? (
        <p className="text-sm text-red-600 py-6 text-center">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {box('ক্যাশ-বুক আয়', taka(r.income), 'bg-green-50', 'text-green-700')}
            {box('মোট ব্যয়', taka(r.expense), 'bg-red-50', 'text-red-700')}
            {box('নিট লাভ/ক্ষতি', taka(r.net), r.net >= 0 ? 'bg-indigo-50' : 'bg-red-50', r.net >= 0 ? 'text-indigo-700' : 'text-red-700')}
            {box('POS এখনো বাকি', taka(r.posDue), 'bg-orange-50', 'text-orange-700')}
          </div>
          <p className="text-xs text-gray-400">
            POS বিক্রি (বিল) {taka(r.posTotal)} • পেইড {taka(r.posPaid)}
            {r.legacyOrders > 0 && ` • ক্যাশ-বুকে নেই এমন পেইড অনলাইন অর্ডার ${taka(r.legacyOrders)} নিট-এ যোগ করা হয়েছে`}
          </p>
          {catList('আয়ের ক্যাটাগরি', r.incomeCat, 'bg-green-50 border border-green-100')}
          {catList('ব্যয়ের ক্যাটাগরি', r.expenseCat, 'bg-orange-50 border border-orange-100')}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">তারিখ</th>
                  <th className="px-3 py-2 text-right">আয়</th>
                  <th className="px-3 py-2 text-right">ব্যয়</th>
                  <th className="px-3 py-2 text-right">নিট</th>
                </tr>
              </thead>
              <tbody>
                {r.days.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-400">এই মাসে কোনো এন্ট্রি নেই</td>
                  </tr>
                ) : (
                  r.days.map(([d, v]) => (
                    <tr key={d} className="border-b border-gray-100">
                      <td className="px-3 py-2">{d}</td>
                      <td className="px-3 py-2 text-right text-green-600">{taka(v.income)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{taka(v.expense)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{taka(v.income - v.expense)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
