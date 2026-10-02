import { useCallback, useEffect, useState } from 'react'
import { supabase, StudentOverview } from '../../lib/supabase'
import StudentsPanel from './StudentsPanel'
import AttendancePanel from './AttendancePanel'

type View = 'students' | 'attendance'
const VIEWS: { id: View; label: string }[] = [
  { id: 'students', label: 'স্টুডেন্ট তালিকা' },
  { id: 'attendance', label: 'হাজিরা' },
]

/** Training Management — স্টুডেন্ট, হাজিরা, ফি/Due, সার্টিফিকেট */
export default function TrainingTab() {
  const [view, setView] = useState<View>('students')
  const [students, setStudents] = useState<StudentOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('student_overview').select('*').order('full_name')
    if (e) {
      console.error('স্টুডেন্ট লোড ত্রুটি:', e)
      setError('স্টুডেন্ট লোড করা যায়নি (ফেজ F-র SQL রান করা আছে কি? শুধু অ্যাডমিন দেখতে পারেন)')
    } else {
      setError('')
    }
    setStudents((data as StudentOverview[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${view === v.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 shadow hover:bg-gray-50'}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
      <div className="bg-white rounded-lg shadow p-6">
        {view === 'students' && <StudentsPanel students={students} reload={load} loading={loading} />}
        {view === 'attendance' && <AttendancePanel students={students} reload={load} />}
      </div>
    </div>
  )
}
