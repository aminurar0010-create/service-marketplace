import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, GraduationCap } from 'lucide-react'
import { supabase, Course, CourseModule } from '../lib/supabase'
import { useSEO } from '../lib/useSEO'
import ModuleAccordion from '../components/ModuleAccordion'
import EnrollmentModal from '../components/EnrollmentModal'

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<CourseModule[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)

  useSEO(
    course ? `${course.title} | নিউ প্রিন্টার্স আইটি সলিউশন` : undefined,
    course ? (course.summary || course.title).slice(0, 155) : undefined
  )

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const { data: courseData } = await supabase
          .from('courses')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .maybeSingle()

        if (!courseData) {
          setNotFound(true)
          return
        }
        setCourse(courseData)

        const { data: moduleData } = await supabase
          .from('course_modules')
          .select('*')
          .eq('course_id', courseData.id)
          .order('display_order', { ascending: true })
        setModules(moduleData || [])
      } catch (error) {
        console.error('কোর্স ডিটেইল লোড ত্রুটি:', error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchCourse()
  }, [slug])

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-charcoal/50">লোড করছি...</div>
  }

  if (notFound || !course) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
        <p className="text-charcoal/60 mb-4">এই কোর্সটি খুঁজে পাওয়া যায়নি</p>
        <Link to="/courses" className="text-ink-600 font-semibold hover:underline">
          সব কোর্স দেখুন
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link to="/courses" className="inline-flex items-center gap-1 text-ink-600 text-sm font-semibold mb-6 hover:underline">
          <ArrowLeft size={16} />
          সব কোর্স
        </Link>

        <div className="rounded-xl overflow-hidden mb-6">
          {course.cover_image_url ? (
            <img src={course.cover_image_url} alt={course.title} className="w-full aspect-[16/9] object-cover" />
          ) : (
            <div className="w-full aspect-[16/9] bg-gradient-to-br from-ink-600 to-ink-700 flex items-center justify-center">
              <GraduationCap className="text-white/80" size={56} />
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-display font-bold text-charcoal mb-3">{course.title}</h1>

        {course.summary && <p className="text-charcoal/70 mb-4">{course.summary}</p>}

        <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-ink-100">
          <div className="flex items-center gap-1.5 text-charcoal/70 text-sm">
            <Clock size={16} />
            মেয়াদ: {course.duration_label || 'যোগাযোগ করুন'}
          </div>
          <div className="font-stamp text-xl font-bold text-ink-600">৳{course.fee}</div>
        </div>

        {course.description && (
          <div className="mb-8 text-charcoal/80 text-sm sm:text-base whitespace-pre-line leading-relaxed">
            {course.description}
          </div>
        )}

        <h2 className="text-lg font-bold text-charcoal mb-3">কোর্স মডিউল / সিলেবাস</h2>
        <div className="mb-8">
          <ModuleAccordion modules={modules} />
        </div>

        <button
          onClick={() => setShowEnroll(true)}
          className="w-full sm:w-auto bg-ink-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-ink-700 transition"
        >
          এখনই ভর্তি হোন
        </button>
      </div>

      {showEnroll && <EnrollmentModal course={course} onClose={() => setShowEnroll(false)} />}
    </div>
  )
}
