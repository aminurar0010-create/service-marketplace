import { useEffect, useState } from 'react'
import { GraduationCap, Pencil, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { supabase, Course, logActivity } from '../lib/supabase'
import CourseFormModal from './CourseFormModal'

export default function CoursesTab() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('courses').select('*').order('display_order', { ascending: true })
      if (error) throw error
      setCourses(data || [])
    } catch (error) {
      console.error('কোর্স লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (course: Course) => {
    try {
      await supabase.from('courses').update({ is_active: !course.is_active }).eq('id', course.id)
      logActivity(course.is_active ? 'কোর্স নিষ্ক্রিয় করা হয়েছে' : 'কোর্স সক্রিয় করা হয়েছে', 'course', course.title)
      fetchCourses()
    } catch (error) {
      console.error('স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const deleteCourse = async (course: Course) => {
    if (!confirm(`"${course.title}" কোর্সটি ডিলিট করতে চান? এর সব মডিউল ও ভর্তির আবেদনও ডিলিট হয়ে যাবে।`)) return
    try {
      await supabase.from('courses').delete().eq('id', course.id)
      logActivity('কোর্স ডিলিট করা হয়েছে', 'course', course.title)
      fetchCourses()
    } catch (error) {
      console.error('ডিলিট ত্রুটি:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">ট্রেনিং কোর্স</h2>
            <p className="text-sm text-gray-500 mt-1">কোর্স ও তার মডিউল/সিলেবাস অ্যাড, এডিট বা ডিলিট করুন</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <Plus size={16} />
          নতুন কোর্স
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ছবি</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">কোর্সের নাম</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">মেয়াদ</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ফি</th>
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
            ) : courses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  কোনো কোর্স পাওয়া যায়নি
                </td>
              </tr>
            ) : (
              courses.map((c) => (
                <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                      {c.cover_image_url ? (
                        <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">/courses/{c.slug}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.duration_label || '—'}</td>
                  <td className="px-6 py-4 text-sm font-semibold">৳{c.fee}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {c.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleActive(c)}
                        className="text-gray-400 hover:text-gray-700"
                        title={c.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                      >
                        {c.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(c)
                          setShowModal(true)
                        }}
                        className="text-indigo-500 hover:text-indigo-700"
                      >
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => deleteCourse(c)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CourseFormModal
          course={editing}
          onClose={() => setShowModal(false)}
          onSaved={fetchCourses}
        />
      )}
    </div>
  )
}
