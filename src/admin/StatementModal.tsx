import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Printer, X } from 'lucide-react'
import { fetchStatement, fetchFullStatement, printStatement, statementTotals, StatementRow } from '../lib/statement'

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })

export interface StatementTarget {
  customerId: string | null
  name: string
  phone: string
  code?: string | null
}

/** বাকির বিবরণী — কাস্টমারের সব বাকি কাজ দেখে (তারিখ/টিক দিয়ে বেছে) এক কাগজে প্রিন্ট */
export default function StatementModal({ target, onClose }: { target: StatementTarget; onClose: () => void }) {
  const [rows, setRows] = useState<StatementRow[]>([])
  const [mode, setMode] = useState<'due' | 'full'>('due') // শুধু বাকি / পূর্ণ হিসাব
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = mode === 'full' ? await fetchFullStatement(target.customerId, target.phone) : await fetchStatement(target.customerId, target.phone)
      setRows(data.rows)
      setUnchecked(new Set())
    } catch (e) {
      console.error('বিবরণী লোড ত্রুটি:', e)
      setError('বিবরণী লোড করা যায়নি। আবার চেষ্টা করুন।')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.customerId, target.phone, mode])

  // তারিখ-ফিল্টারের ভেতরের সারি
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        const d = format(new Date(r.date), 'yyyy-MM-dd')
        return (!from || d >= from) && (!to || d <= to)
      }),
    [rows, from, to]
  )
  const selected = visible.filter((r) => !unchecked.has(r.key))
  const totals = statementTotals(selected)

  const toggle = (key: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">বাকির বিবরণী</h3>
            <p className="text-sm text-gray-600">
              {target.name} • {target.phone}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:bg-gray-100 rounded" aria-label="বন্ধ করুন">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 text-sm">
          {([
            ['due', 'শুধু বাকি'],
            ['full', 'পূর্ণ হিসাব (সব কাজ)'],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded border font-semibold transition ${
                mode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-gray-600 text-sm">লোড করছি...</p>
        ) : error ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={load} className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded">
              আবার চেষ্টা করুন
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-gray-500 text-sm">
            {mode === 'full' ? 'এই কাস্টমারের কোনো কাজ পাওয়া যায়নি' : 'এই কাস্টমারের কোনো বাকি নেই 🎉'}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-600">তারিখ থেকে</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-600">তারিখ পর্যন্ত</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded" />
              </label>
              {(from || to) && (
                <button onClick={() => { setFrom(''); setTo('') }} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded">
                  ফিল্টার মুছুন
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-left">তারিখ</th>
                    <th className="px-3 py-2 text-left">কাজ</th>
                    <th className="px-3 py-2 text-right">মোট</th>
                    <th className="px-3 py-2 text-right">পেয়েছি</th>
                    <th className="px-3 py-2 text-right">বাকি</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-500">এই তারিখের মধ্যে কোনো কাজ নেই</td>
                    </tr>
                  ) : (
                    visible.map((r) => (
                      <tr key={r.key} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={!unchecked.has(r.key)} onChange={() => toggle(r.key)} className="w-4 h-4" aria-label={r.ref} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{format(new Date(r.date), 'dd/MM/yyyy')}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold">{r.ref}</p>
                          <p className="text-xs text-gray-500">{r.title}</p>
                          {mode === 'full' && r.desc && <p className="text-xs text-gray-700">{r.desc}</p>}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{taka(r.total)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-green-700">{taka(r.paid)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-bold text-red-600">
                          {r.due > 0 ? taka(r.due) : <span className="text-green-700 text-xs font-semibold">পরিশোধিত</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-700">
                {totals.count}টি কাজ • মোট {taka(totals.total)} • পেয়েছি {taka(totals.paid)} •{' '}
                <span className="font-bold text-red-600">বাকি {taka(totals.due)}</span>
              </p>
              <button
                onClick={() => (mode === 'full' ? printStatement(target, selected, 'বিস্তারিত হিসাব বিবরণী', true) : printStatement(target, selected))}
                disabled={selected.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                <Printer size={16} /> প্রিন্ট করুন
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
