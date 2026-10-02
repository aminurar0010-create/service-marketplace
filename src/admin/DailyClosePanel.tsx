import { useCallback, useEffect, useState } from 'react'
import { Lock, Unlock, Printer } from 'lucide-react'
import { supabase, logActivity, DaySummary, DailyClosing } from '../lib/supabase'
import { PAY_METHODS } from './pos/posTypes'

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')

/** দিনের হিসাব বন্ধ করুন (Daily Close) — Cash/bKash/Nagad/Rocket আলাদা যোগফল, Expense, Net Result */
export default function DailyClosePanel({ date }: { date: string }) {
  const [live, setLive] = useState<DaySummary | null>(null)
  const [closing, setClosing] = useState<DailyClosing | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [s, c] = await Promise.all([
      supabase.rpc('day_summary', { p_date: date }),
      supabase.from('daily_closings').select('*').eq('close_date', date).maybeSingle(),
    ])
    if (s.error) console.error('দিনের সারাংশ ত্রুটি:', s.error)
    setLive(s.data?.success ? (s.data as DaySummary) : null)
    setClosing((c.data as DailyClosing) || null)
    setLoading(false)
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  const closeDay = async () => {
    if (!window.confirm(`${date} তারিখের হিসাব বন্ধ করবেন?`)) return
    setBusy(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('close_day', { p_date: date, p_note: note })
    setBusy(false)
    if (rpcError || !data?.success) {
      setError(data?.message || 'হিসাব বন্ধ করতে সমস্যা হয়েছে')
      if (rpcError) console.error('হিসাব বন্ধ ত্রুটি:', rpcError)
      return
    }
    logActivity('দিনের হিসাব বন্ধ করা হয়েছে', 'daily_closing', date)
    setNote('')
    load()
  }

  const reopen = async () => {
    if (!window.confirm('হিসাব আবার খুলবেন? (শুধু অ্যাডমিন পারবেন)')) return
    setBusy(true)
    const { data, error: delError } = await supabase.from('daily_closings').delete().eq('close_date', date).select()
    setBusy(false)
    if (delError || !data || data.length === 0) {
      setError('হিসাব খোলা যায়নি — শুধু অ্যাডমিন এটি করতে পারেন')
      return
    }
    logActivity('দিনের হিসাব আবার খোলা হয়েছে', 'daily_closing', date)
    load()
  }

  const view = closing || live
  const changedAfterClose =
    closing && live && (Number(live.income_total) !== Number(closing.income_total) || Number(live.expense_total) !== Number(closing.expense_total))

  return (
    <div className="bg-white rounded-lg shadow p-6 print:shadow-none">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h3 className="font-bold flex items-center gap-2">
          {closing ? <Lock size={18} className="text-green-600" /> : <Unlock size={18} className="text-indigo-600" />}
          দিনের হিসাব — {date}
          {closing && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">বন্ধ</span>}
        </h3>
        <button onClick={() => window.print()} className="print:hidden flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600">
          <Printer size={16} /> প্রিন্ট
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">লোড করছি...</p>
      ) : !view ? (
        <p className="text-sm text-red-600">সারাংশ লোড করা যায়নি (SQL রান করা হয়েছে কি?)</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">POS বিক্রি</p>
              <p className="text-lg font-bold">{taka(view.sales_total)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">নতুন বাকি</p>
              <p className="text-lg font-bold text-red-700">{taka(view.new_due)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">মোট আয়</p>
              <p className="text-lg font-bold text-green-700">{taka(view.income_total)}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">মোট ব্যয়</p>
              <p className="text-lg font-bold text-orange-700">{taka(view.expense_total)}</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">নিট ফলাফল</p>
              <p className={`text-lg font-bold ${view.net_result >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{taka(view.net_result)}</p>
            </div>
          </div>

          <div className="overflow-x-auto mb-3">
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
                  const r = view.by_method?.[m.id] || { income: 0, expense: 0, net: 0 }
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

          {changedAfterClose && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded p-2 mb-3">
              ⚠️ হিসাব বন্ধ করার পর এই তারিখে নতুন এন্ট্রি হয়েছে — উপরের সংখ্যা বন্ধ করার সময়ের।
            </p>
          )}
          {closing?.note && <p className="text-sm text-gray-600 mb-3">নোট: {closing.note}</p>}
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

          <div className="print:hidden">
            {closing ? (
              <button onClick={reopen} disabled={busy} className="text-sm text-gray-600 underline disabled:opacity-50">
                হিসাব আবার খুলুন (অ্যাডমিন)
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="নোট (ঐচ্ছিক) — যেমন: ক্যাশ ড্রয়ারে গোনা টাকা"
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  onClick={closeDay}
                  disabled={busy}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {busy ? 'বন্ধ হচ্ছে...' : 'আজকের হিসাব বন্ধ করুন'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
