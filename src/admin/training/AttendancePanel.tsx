import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { supabase, logActivity, StudentOverview } from '../../lib/supabase'
import { todayDhaka } from '../reports/reportUtils'

type Att = 'present' | 'absent' | 'late' | 'leave'
const OPTIONS: { id: Att; label: string; on: string }[] = [
  { id: 'present', label: 'উপস্থিত', on: 'bg-green-600 text-white border-green-600' },
  { id: 'late', label: 'দেরি', on: 'bg-amber-500 text-white border-amber-500' },
  { id: 'absent', label: 'অনুপস্থিত', on: 'bg-red-600 text-white border-red-600' },
  { id: 'leave', label: 'ছুটি', on: 'bg-gray-500 text-white border-gray-500' },
]

/** ব্যাচ/কোর্স ধরে দৈনিক হাজিরা */
export default function AttendancePanel({ students, reload }: { students: StudentOverview[]; reload: () => void }) {
  const running = useMemo(() => students.filter((s) => s.training_status === 'running'), [students])
  const courses = useMemo(() => [...new Map(running.map((s) => [s.course_id, s.course_title])).entries()], [running])
  const [course, setCourse] = useState('')
  const [batch, setBatch] = useState('all')
  const [date, setDate] = useState(todayDhaka())
  const [marks, setMarks] = useState<Record<string, Att>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!course && courses.length) setCourse(courses[0][0])
  }, [courses, course])

  const batches = useMemo(() => [...new Set(running.filter((s) => s.course_id === course).map((s) => s.batch_name || ''))], [running, course])
  const list = running.filter((s) => s.course_id === course && (batch === 'all' || (s.batch_name || '') === batch))

  const loadMarks = useCallback(async () => {
    setMsg('')
    if (list.length === 0) {
      setMarks({})
      return
    }
    const { data, error } = await supabase
      .from('student_attendance')
      .select('enrollment_id, status')
      .eq('attendance_date', date)
      .in('enrollment_id', list.map((s) => s.id))
    if (error) console.error('হাজিরা লোড ত্রুটি:', error)
    const m: Record<string, Att> = {}
    ;(data || []).forEach((r: any) => (m[r.enrollment_id] = r.status))
    setMarks(m)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, course, batch, students])

  useEffect(() => {
    loadMarks()
  }, [loadMarks])

  const markAll = () => setMarks(Object.fromEntries(list.map((s) => [s.id, 'present' as Att])))

  const save = async () => {
    const rows = list.filter((s) => marks[s.id]).map((s) => ({ enrollment_id: s.id, attendance_date: date, status: marks[s.id] }))
    if (rows.length === 0) {
      setMsg('কারো হাজিরা বাছাই করা হয়নি')
      return
    }
    setSaving(true)
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('student_attendance')
      .upsert(rows.map((r) => ({ ...r, marked_by: u.user?.id })), { onConflict: 'enrollment_id,attendance_date' })
    setSaving(false)
    if (error) {
      console.error('হাজিরা সেভ ত্রুটি:', error)
      setMsg('সেভ করা যায়নি')
      return
    }
    logActivity('হাজিরা সেভ করা হয়েছে', 'attendance', date, { count: rows.length })
    setMsg(`✅ ${rows.length} জনের হাজিরা সেভ হয়েছে`)
    reload()
  }

  if (courses.length === 0) return <p className="text-center text-gray-500 py-8 text-sm">হাজিরার জন্য কোনো চলমান স্টুডেন্ট নেই</p>

  const unmarked = list.filter((s) => !marks[s.id]).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={course} onChange={(e) => { setCourse(e.target.value); setBatch('all') }} className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none">
          {courses.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        <select value={batch} onChange={(e) => setBatch(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none">
          <option value="all">সব ব্যাচ</option>
          {batches.map((b) => (
            <option key={b} value={b}>{b || 'ব্যাচ নেই'}</option>
          ))}
        </select>
        <input type="date" value={date} max={todayDhaka()} onChange={(e) => e.target.value && setDate(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none" />
        <button onClick={markAll} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
          <CheckCheck size={16} /> সবাইকে উপস্থিত
        </button>
      </div>

      <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
        {list.map((s) => (
          <div key={s.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <div>
              <p className="font-semibold text-sm">{s.full_name}</p>
              <p className="text-xs text-gray-500">
                উপস্থিত {s.present_count + s.late_count}/{s.total_classes} • অনুপস্থিত {s.absent_count}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OPTIONS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setMarks({ ...marks, [s.id]: o.id })}
                  className={`px-2.5 py-1 rounded border text-xs font-semibold transition ${marks[s.id] === o.id ? o.on : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={save} disabled={saving} className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'সেভ হচ্ছে...' : 'হাজিরা সেভ করুন'}
        </button>
        {unmarked > 0 && <span className="text-xs text-amber-700">{unmarked} জনের হাজিরা বাকি (সেভ করলে বাদ যাবে)</span>}
        {msg && <span className="text-sm text-gray-700">{msg}</span>}
      </div>
    </div>
  )
}
