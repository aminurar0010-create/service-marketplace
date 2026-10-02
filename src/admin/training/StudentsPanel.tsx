import { useEffect, useMemo, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { supabase, logActivity, StudentOverview } from '../../lib/supabase'

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')
export const TRAINING_LABEL = { running: 'চলমান', completed: 'সম্পন্ন', dropped: 'ঝরে পড়া' } as const
const TRAINING_STYLE = { running: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800', dropped: 'bg-gray-200 text-gray-600' } as const

/** নিশ্চিত ভর্তির স্টুডেন্ট তালিকা — ব্যাচ, ফি, ডিসকাউন্ট, ট্রেনিং স্ট্যাটাস সম্পাদনা */
export default function StudentsPanel({ students, reload, loading }: { students: StudentOverview[]; reload: () => void; loading: boolean }) {
  const [course, setCourse] = useState('all')
  const [status, setStatus] = useState<'all' | StudentOverview['training_status']>('running')
  const [editing, setEditing] = useState<StudentOverview | null>(null)
  const [form, setForm] = useState({ batch_name: '', start_date: '', fee_total: '', discount: '', training_status: 'running' })
  const [saving, setSaving] = useState(false)

  const courses = useMemo(() => [...new Map(students.map((s) => [s.course_id, s.course_title])).entries()], [students])
  const list = students.filter((s) => (course === 'all' || s.course_id === course) && (status === 'all' || s.training_status === status))

  useEffect(() => {
    if (!editing) return
    setForm({
      batch_name: editing.batch_name || '',
      start_date: editing.start_date || '',
      fee_total: String(editing.fee_total),
      discount: String(editing.discount),
      training_status: editing.training_status,
    })
  }, [editing])

  const save = async () => {
    if (!editing) return
    const fee = Number(form.fee_total)
    const discount = Number(form.discount || 0)
    if (isNaN(fee) || fee < 0 || isNaN(discount) || discount < 0 || discount > fee) {
      alert('ফি ও ডিসকাউন্ট সঠিকভাবে দিন (ডিসকাউন্ট ফি-এর বেশি হতে পারবে না)')
      return
    }
    if (fee - discount < editing.paid && !window.confirm('নতুন ফি এখন পর্যন্ত নেওয়া টাকার চেয়ে কম। তবুও সেভ করবেন?')) return
    setSaving(true)
    const { error } = await supabase
      .from('enrollments')
      .update({
        batch_name: form.batch_name.trim() || null,
        start_date: form.start_date || null,
        fee_total: fee,
        discount,
        training_status: form.training_status,
      })
      .eq('id', editing.id)
    setSaving(false)
    if (error) {
      console.error('স্টুডেন্ট আপডেট ত্রুটি:', error)
      alert('সেভ করা যায়নি')
      return
    }
    logActivity('স্টুডেন্টের তথ্য আপডেট', 'enrollment', editing.full_name, { batch: form.batch_name, fee, discount })
    setEditing(null)
    reload()
  }

  const inp = 'mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select value={course} onChange={(e) => setCourse(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none">
          <option value="all">সব কোর্স</option>
          {courses.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none">
          <option value="all">সব স্ট্যাটাস</option>
          <option value="running">চলমান</option>
          <option value="completed">সম্পন্ন</option>
          <option value="dropped">ঝরে পড়া</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{list.length} জন</span>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">লোড করছি...</p>
      ) : list.length === 0 ? (
        <p className="text-center text-gray-500 py-8 text-sm">
          কোনো স্টুডেন্ট নেই। “Student Enrollments” ট্যাবে আবেদন “ভর্তি নিশ্চিত” করলে এখানে আসবে।
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">স্টুডেন্ট</th>
                <th className="px-3 py-2 text-left">কোর্স / ব্যাচ</th>
                <th className="px-3 py-2 text-left">ফি / Due</th>
                <th className="px-3 py-2 text-left">হাজিরা</th>
                <th className="px-3 py-2 text-left">স্ট্যাটাস</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const attended = s.present_count + s.late_count
                const pct = s.total_classes ? Math.round((attended / s.total_classes) * 100) : null
                return (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{s.full_name}</p>
                      <p className="text-xs text-gray-500">{s.phone}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{s.course_title}</p>
                      <p className="text-xs text-gray-500">{s.batch_name || 'ব্যাচ নেই'}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{taka(s.net_fee)}</p>
                      <p className={`text-xs font-semibold ${s.due > 0 ? 'text-red-600' : 'text-green-700'}`}>{s.due > 0 ? `বাকি ${taka(s.due)}` : 'পরিশোধিত'}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{pct === null ? '—' : `${pct}% (${attended}/${s.total_classes})`}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TRAINING_STYLE[s.training_status]}`}>{TRAINING_LABEL[s.training_status]}</span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => setEditing(s)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded" title="সম্পাদনা">
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold">{editing.full_name}</h3>
                <p className="text-xs text-gray-500">{editing.course_title}</p>
              </div>
              <button onClick={() => setEditing(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <label className="block text-sm font-semibold text-gray-700">ব্যাচের নাম
              <input value={form.batch_name} onChange={(e) => setForm({ ...form, batch_name: e.target.value })} placeholder="যেমন: সকাল ব্যাচ — অক্টোবর ২০২৬" className={inp} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">শুরুর তারিখ
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inp} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-gray-700">মোট ফি (৳)
                <input type="number" value={form.fee_total} onChange={(e) => setForm({ ...form, fee_total: e.target.value })} className={inp} />
              </label>
              <label className="block text-sm font-semibold text-gray-700">ডিসকাউন্ট (৳)
                <input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className={inp} />
              </label>
            </div>
            <label className="block text-sm font-semibold text-gray-700">ট্রেনিং স্ট্যাটাস
              <select value={form.training_status} onChange={(e) => setForm({ ...form, training_status: e.target.value })} className={inp}>
                <option value="running">চলমান</option>
                <option value="completed">সম্পন্ন</option>
                <option value="dropped">ঝরে পড়া</option>
              </select>
            </label>
            <button onClick={save} disabled={saving} className="w-full py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
