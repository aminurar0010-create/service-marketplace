import { useCallback, useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { supabase, DaySummary, CashTransaction } from '../../lib/supabase'
import { PAY_METHODS } from '../pos/posTypes'
import { taka, todayDhaka, rangeIso, printReport } from './reportUtils'

interface DayExtra {
  newCustomers: number
  oldCustomers: number
  totalCustomers: number
  collection: number
  totalDueNow: number
  onlinePaid: number
  expenseByCategory: [string, number][]
}

/** Daily Report — কাস্টমার, বিক্রি, আদায়, বাকি, মাধ্যমভিত্তিক আয়, ব্যয়, নিট ফলাফল */
export default function DailyReport() {
  const [date, setDate] = useState(todayDhaka())
  const [sum, setSum] = useState<DaySummary | null>(null)
  const [extra, setExtra] = useState<DayExtra | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { start, end } = rangeIso(date, date)
    try {
      const [s, pos, ord, newC, totalC, col, due, cash] = await Promise.all([
        supabase.rpc('day_summary', { p_date: date }),
        supabase.from('pos_sales').select('shop_customer_id').eq('status', 'completed').gte('created_at', start).lt('created_at', end),
        supabase.from('orders').select('shop_customer_id').gte('created_at', start).lt('created_at', end),
        supabase.from('shop_customers').select('id').gte('created_at', start).lt('created_at', end),
        supabase.from('shop_customers').select('id', { count: 'exact', head: true }),
        supabase.from('sale_payments').select('amount').eq('kind', 'due_collection').gte('created_at', start).lt('created_at', end),
        supabase.from('customer_dues').select('total_due'),
        supabase.from('cash_transactions').select('*').eq('entry_date', date),
      ])
      if (s.error || !s.data?.success) throw s.error || new Error(s.data?.message || 'সারাংশ লোড হয়নি')
      setSum(s.data as DaySummary)

      const served = new Set<string>()
      ;[...(pos.data || []), ...(ord.data || [])].forEach((r: any) => r.shop_customer_id && served.add(r.shop_customer_id))
      const newIds = new Set((newC.data || []).map((r: any) => r.id))
      const newCustomers = [...served].filter((id) => newIds.has(id)).length

      const byCat: Record<string, number> = {}
      ;((cash.data as CashTransaction[]) || [])
        .filter((t) => t.type === 'expense')
        .forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount)))
      const onlinePaid = ((cash.data as CashTransaction[]) || [])
        .filter((t) => t.type === 'income' && t.source === 'online_order')
        .reduce((a, t) => a + Number(t.amount), 0)

      setExtra({
        newCustomers,
        oldCustomers: served.size - newCustomers,
        totalCustomers: totalC.count || 0,
        collection: (col.data || []).reduce((a: number, r: any) => a + Number(r.amount), 0),
        totalDueNow: (due.data || []).reduce((a: number, r: any) => a + Number(r.total_due), 0),
        onlinePaid,
        expenseByCategory: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
      })
    } catch (e: any) {
      console.error('ডেইলি রিপোর্ট ত্রুটি:', e)
      setError('রিপোর্ট লোড করা যায়নি (ফেজ C-র SQL রান করা আছে কি?)')
    }
    setLoading(false)
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  const print = () => {
    if (!sum || !extra) return
    printReport('ডেইলি রিপোর্ট', date, [
      {
        heading: 'সারসংক্ষেপ',
        rows: [
          ['বিষয়', 'পরিমাণ'],
          ['আজ এসেছেন (নতুন / পুরনো)', `${extra.newCustomers} / ${extra.oldCustomers}`],
          ['মোট নিবন্ধিত কাস্টমার', String(extra.totalCustomers)],
          ['POS বিক্রি', taka(sum.sales_total)],
          ['নতুন বাকি', taka(sum.new_due)],
          ['বাকি আদায়', taka(extra.collection)],
          ['মোট আয় (ক্যাশ-বুক)', taka(sum.income_total)],
          ['মোট ব্যয়', taka(sum.expense_total)],
          ['নিট ফলাফল', taka(sum.net_result)],
          ['বর্তমান মোট বকেয়া', taka(extra.totalDueNow)],
        ],
      },
      {
        heading: 'মাধ্যমভিত্তিক',
        rows: [['মাধ্যম', 'আয়', 'ব্যয়', 'নিট'], ...PAY_METHODS.map((m) => {
          const r = sum.by_method?.[m.id] || { income: 0, expense: 0, net: 0 }
          return [m.label, taka(r.income), taka(r.expense), taka(r.net)]
        })],
      },
      ...(extra.expenseByCategory.length
        ? [{ heading: 'ব্যয়ের ক্যাটাগরি', rows: [['ক্যাটাগরি', 'পরিমাণ'], ...extra.expenseByCategory.map(([c, a]) => [c, taka(a)])] }]
        : []),
    ])
  }

  const card = (label: string, value: string, tone = 'bg-gray-50', text = 'text-gray-800') => (
    <div className={`${tone} rounded-lg p-3`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${text}`}>{value}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <input
          type="date"
          value={date}
          max={todayDhaka()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button onClick={print} disabled={!sum || !extra} className="flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 disabled:opacity-40">
          <Printer size={16} /> প্রিন্ট
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-6 text-center">লোড করছি...</p>
      ) : error || !sum || !extra ? (
        <p className="text-sm text-red-600 py-6 text-center">{error || 'রিপোর্ট নেই'}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {card('নতুন কাস্টমার', String(extra.newCustomers))}
            {card('পুরনো কাস্টমার', String(extra.oldCustomers))}
            {card('মোট নিবন্ধিত কাস্টমার', String(extra.totalCustomers))}
            {card('বর্তমান মোট বকেয়া', taka(extra.totalDueNow), 'bg-red-50', 'text-red-700')}
            {card('POS বিক্রি', taka(sum.sales_total))}
            {card('নতুন বাকি', taka(sum.new_due), 'bg-red-50', 'text-red-700')}
            {card('বাকি আদায়', taka(extra.collection), 'bg-green-50', 'text-green-700')}
            {card('অনলাইন অর্ডার (পেইড)', taka(extra.onlinePaid))}
            {card('মোট আয়', taka(sum.income_total), 'bg-green-50', 'text-green-700')}
            {card('মোট ব্যয়', taka(sum.expense_total), 'bg-orange-50', 'text-orange-700')}
            {card('নিট ফলাফল', taka(sum.net_result), 'bg-indigo-50', sum.net_result >= 0 ? 'text-indigo-700' : 'text-red-700')}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">মাধ্যম</th>
                  <th className="px-3 py-2 text-right">আয়</th>
                  <th className="px-3 py-2 text-right">ব্যয়</th>
                  <th className="px-3 py-2 text-right">নিট</th>
                </tr>
              </thead>
              <tbody>
                {PAY_METHODS.map((m) => {
                  const r = sum.by_method?.[m.id] || { income: 0, expense: 0, net: 0 }
                  return (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-medium">{m.id === 'other' ? 'অন্যান্য / অনির্দিষ্ট' : m.label}</td>
                      <td className="px-3 py-2 text-right text-green-600">{taka(r.income)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{taka(r.expense)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{taka(r.net)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {extra.expenseByCategory.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">ব্যয়ের ক্যাটাগরি</p>
              <div className="flex flex-wrap gap-2">
                {extra.expenseByCategory.map(([c, a]) => (
                  <span key={c} className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5 text-sm">
                    {c}: <b>{taka(a)}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400">
            * আয়-ব্যয় ক্যাশ-বুকের সাথে মেলে (“দিনের হিসাব” প্যানেলের একই হিসাব)। নতুন বাকি ও আদায় বিক্রয়-হিসাব থেকে।
          </p>
        </>
      )}
    </div>
  )
}
