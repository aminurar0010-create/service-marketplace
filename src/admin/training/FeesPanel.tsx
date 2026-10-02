import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { X, Undo2 } from 'lucide-react'
import { supabase, logActivity, StudentOverview, StudentPayment } from '../../lib/supabase'
import { PAY_METHODS, PayMethod, payMethodLabel } from '../pos/posTypes'

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')

/** কোর্স ফি — কিস্তিতে আদায়, স্টুডেন্ট-ভিত্তিক Due; আদায় ক্যাশ-বুকে আয় ('কোর্স ফি') হিসেবে যায় */
export default function FeesPanel({ students, reload }: { students: StudentOverview[]; reload: () => void }) {
  const [onlyDue, setOnlyDue] = useState(true)
  const [course, setCourse] = useState('all')
  const [target, setTarget] = useState<StudentOverview | null>(null)
  const [payments, setPayments] = useState<StudentPayment[]>([])
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayMethod>('cash')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const courses = useMemo(() => [...new Map(students.map((s) => [s.course_id, s.course_title])).entries()], [students])
  const list = students
    .filter((s) => s.training_status !== 'dropped' || s.due > 0)
    .filter((s) => (course === 'all' || s.course_id === course) && (!onlyDue || s.due > 0))
    .sort((a, b) => b.due - a.due)
  const totalDue = list.reduce((a, s) => a + Number(s.due), 0)
  const current = target ? students.find((s) => s.id === target.id) || target : null

  const loadPayments = async (id: string) => {
    const { data, error: e } = await supabase.from('student_payments').select('*').eq('enrollment_id', id).order('created_at', { ascending: false })
    if (e) console.error('ফি ইতিহাস লোড ত্রুটি:', e)
    setPayments((data as StudentPayment[]) || [])
  }

  useEffect(() => {
    if (target) {
      loadPayments(target.id)
      setAmount('')
      setNote('')
      setMethod('cash')
      setError('')
    }
  }, [target?.id])

  const submit = async () => {
    if (!current) return
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('পরিমাণ সঠিকভাবে দিন')
      return
    }
    setBusy(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('collect_student_fee', { p_enrollment_id: current.id, p_amount: value, p_method: method, p_note: note })
    setBusy(false)
    if (rpcError || !data?.success) {
      setError(data?.message || 'আদায় করা যায়নি')
      if (rpcError) console.error('কোর্স ফি আদায় ত্রুটি:', rpcError)
      return
    }
    logActivity('কোর্স ফি আদায়', 'enrollment', current.full_name, { amount: value, method })
    setAmount('')
    setNote('')
    loadPayments(current.id)
    reload()
  }

  const voidPayment = async (p: StudentPayment) => {
    if (!window.confirm(`${taka(p.amount)} এর এই আদায় বাতিল করবেন? ক্যাশ-বুক থেকেও এন্ট্রিটি মুছে যাবে।`)) return
    const { data, error: rpcError } = await supabase.rpc('void_student_payment', { p_payment_id: p.id })
    if (rpcError || !data?.success) {
      alert(data?.message || 'বাতিল করা যায়নি')
      return
    }
    logActivity('কোর্স ফি আদায় বাতিল', 'enrollment', current?.full_name, { amount: p.amount })
    if (current) loadPayments(current.id)
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={course} onChange={(e) => setCourse(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none">
          <option value="all">সব কোর্স</option>
          {courses.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} /> শুধু বকেয়াসহ
        </label>
        <span className="text-sm font-semibold text-red-600 ml-auto">মোট বকেয়া {taka(totalDue)}</span>
      </div>

      {list.length === 0 ? (
        <p className="text-center text-gray-500 py-8 text-sm">{onlyDue ? 'কোনো বকেয়া নেই 🎉' : 'কোনো স্টুডেন্ট নেই'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">স্টুডেন্ট</th>
                <th className="px-3 py-2 text-left">কোর্স</th>
                <th className="px-3 py-2 text-right">ফি</th>
                <th className="px-3 py-2 text-right">পেইড</th>
                <th className="px-3 py-2 text-right">বাকি</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="px-3 py-2">
                    <p className="font-semibold">{s.full_name}</p>
                    <p className="text-xs text-gray-500">{s.phone}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{s.course_title}</td>
                  <td className="px-3 py-2 text-right">{taka(s.net_fee)}</td>
                  <td className="px-3 py-2 text-right text-green-700">{taka(s.paid)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${s.due > 0 ? 'text-red-600' : 'text-gray-400'}`}>{taka(s.due)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setTarget(s)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700">
                      {s.due > 0 ? 'ফি নিন' : 'ইতিহাস'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold">{current.full_name}</h3>
                <p className="text-xs text-gray-500">
                  {current.course_title} • ফি {taka(current.net_fee)} • পেইড {taka(current.paid)}
                </p>
                <p className={`text-sm font-bold ${current.due > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {current.due > 0 ? `বাকি ${taka(current.due)}` : 'সম্পূর্ণ পরিশোধিত'}
                </p>
              </div>
              <button onClick={() => setTarget(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>

            {current.due > 0 && (
              <div className="space-y-3 border border-gray-100 rounded-lg p-3">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="আদায়ের পরিমাণ (৳)" className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                <div className="flex flex-wrap gap-2">
                  {PAY_METHODS.map((m) => (
                    <button key={m.id} onClick={() => setMethod(m.id)} className={`px-3 py-1.5 rounded text-sm border ${method === m.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="নোট (ঐচ্ছিক) — যেমন: ২য় কিস্তি" className="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none" />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button onClick={submit} disabled={busy} className="w-full py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 disabled:opacity-50">
                  {busy ? 'আদায় হচ্ছে...' : 'আদায় নিশ্চিত করুন'}
                </button>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">ফি আদায়ের ইতিহাস</p>
              {payments.length === 0 ? (
                <p className="text-xs text-gray-400">এখনো কিছু নেওয়া হয়নি</p>
              ) : (
                <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                  {payments.map((p) => (
                    <li key={p.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-green-700">{taka(p.amount)} <span className="text-xs text-gray-500 font-normal">• {payMethodLabel(p.method)}</span></p>
                        <p className="text-xs text-gray-500 truncate">{format(new Date(p.created_at), 'dd/MM/yyyy')}{p.note ? ` • ${p.note}` : ''}</p>
                      </div>
                      <button onClick={() => voidPayment(p)} title="বাতিল" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"><Undo2 size={15} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
