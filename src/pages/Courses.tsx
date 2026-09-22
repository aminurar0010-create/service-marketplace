import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { supabase, Course } from '../lib/supabase'
import { useSEO } from '../lib/useSEO'
import CourseCard from '../components/CourseCard'

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useSEO('ট্রেনিং কোর্স | নিউ প্রিন্টার্স আইটি সলিউশন', 'কম্পিউটার অফিস অ্যাপ্লিকেশন, গ্রাফিক ডিজাইন, ওয়েব ডেভেলপমেন্ট, ডিজিটাল মার্কেটিং ও নেটওয়ার্কিং কোর্স')

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data } = await supabase
          .from('courses')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
        setCourses(data || [])
      } catch (error) {
        console.error('কোর্স লোড ত্রুটি:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCourses()
  }, [])

  return (
    <div className="min-h-screen bg-paper px-4 py-14">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="w-12 h-12 bg-ink-600 rounded-full flex items-center justify-center text-white mx-auto mb-4">
            <GraduationCap size={22} />
          </div>
          <h1 className="text-3xl font-display font-bold text-charcoal">ট্রেনিং কোর্সসমূহ</h1>
          <p className="text-charcoal/60 mt-2">হাতে-কলমে প্রশিক্ষণ নিয়ে দক্ষতা বাড়ান, ক্যারিয়ার শুরু করুন</p>
        </div>

        {loading ? (
          <p className="text-center text-charcoal/50 py-12">লোড করছি...</p>
        ) : courses.length === 0 ? (
          <p className="text-center text-charcoal/50 py-12">এই মুহূর্তে কোনো কোর্স চালু নেই</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
