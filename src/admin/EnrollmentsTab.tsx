import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { BookUser, Phone, Trash2 } from 'lucide-react'
import { supabase, Course, Enrollment, logActivity } from '../lib/supabase'

const STATUS_LABEL: Record<Enrollment['status'], string> = {
  pending: 'নতুন',
  contacted: 'যোগাযোগ করা হয়েছে',
  confirmed: 'ভর্তি নিশ্চিত',
  cancelled: 'বাতিল',
}

const STATUS_STYLE: Record<Enrollment['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-600',
}

export default function EnrollmentsTab() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [courses, setCourses] = useState<Record<string, Course>>({})
  const [loading, setLoading] = useState(true)
  const [courseFilter, setCourseFilter] = useState<string>('all')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: enrollmentData, error: enrollmentError }, { data: courseData }] = await Promise.all([
        supabase.from('enrollments').select('*').order('created_at', { ascending: false }),
        supabase.from('courses').select('*'),
      ])
      if (enrollmentError) throw enrollmentError
      setEnrollments(enrollmentData || [])
      const courseMap: Record<string, Course> = {}
      ;(courseData || []).forEach((c: Course) => {
        courseMap[c.id] = c
      })
      setCourses(courseMap)
    } catch (error) {
      console.error('ভর্তির আবেদন লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (enrollment: Enrollment, status: Enrollment['status']) => {
    try {
      await supabase.from('enrollments').update({ status }).eq('id', enrollment.id)
      logActivity('ভর্তির আবেদনের স্ট্যাটাস পরিবর্তন', 'enrollment', enrollment.full_name, { status })
      fetchData()
    } catch (error) {
      console.error('স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const deleteEnrollment = async (enrollment: Enrollment) => {
    if (!confirm(`"${enrollment.full_name}"-এর আবেদনটি ডিলিট করতে চান?`)) return
    try {
      await supabase.from('enrollments').delete().eq('id', enrollment.id)
      logActivity('ভর্তির আবেদন ডিলিট করা হয়েছে', 'enrollment', enrollment.full_name)
      fetchData()
    } catch (error) {
      console.error('ডিলিট ত্রুটি:', error)
    }
  }

  const filtered = courseFilter === 'all' ? enrollments : enrollments.filter((e) => e.course_id === courseFilter)

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookUser className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">স্টুডেন্ট ভর্তির আবেদন</h2>
            <p className="text-sm text-gray-500 mt-1">কে কোন কোর্সে ভর্তি হতে চায় তা দেখুন ও স্ট্যাটাস আপডেট করুন</p>
          </div>
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">সব কোর্স</option>
          {Object.values(courses).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্টুডেন্ট</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">কোর্স</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">মোবাইল</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সময়</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্ট্যাটাস</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  লোড হচ্ছে...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  কোনো ভর্তির আবেদন পাওয়া যায়নি
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-b border-gray-200 hover:bg-gray-50 align-top">
                  <td className="px-6 py-4 text-sm">
                    <p className="font-semibold">{e.full_name}</p>
                    {e.email && <p className="text-gray-400 text-xs mt-0.5">{e.email}</p>}
                    {e.message && <p className="text-gray-500 text-xs mt-1 max-w-xs">{e.message}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{courses[e.course_id]?.title || '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <a href={`tel:${e.phone}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                      <Phone size={14} />
                      {e.phone}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: bn })}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={e.status}
                      onChange={(ev) => updateStatus(e, ev.target.value as Enrollment['status'])}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUS_STYLE[e.status]}`}
                    >
                      {(Object.keys(STATUS_LABEL) as Enrollment['status'][]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => deleteEnrollment(e)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
