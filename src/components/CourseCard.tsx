import { Link } from 'react-router-dom'
import { GraduationCap, Clock } from 'lucide-react'
import { Course } from '../lib/supabase'

export default function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      to={`/courses/${course.slug}`}
      className="group bg-white rounded-lg shadow-sm hover:shadow-lg transition overflow-hidden doc-frame flex flex-col"
    >
      <div className="aspect-[16/9] overflow-hidden">
        {course.cover_image_url ? (
          <img
            src={course.cover_image_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="bg-gradient-to-br from-ink-600 to-ink-700 w-full h-full flex items-center justify-center">
            <GraduationCap className="text-white/80" size={40} />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col p-4 sm:p-5">
        <h3 className="font-bold text-charcoal text-base sm:text-lg mb-2 leading-snug group-hover:text-ink-600 transition">
          {course.title}
        </h3>

        {course.summary && (
          <p
            className="text-charcoal/60 text-sm mb-4"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {course.summary}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-ink-50">
          <div className="flex items-center gap-1 text-charcoal/60 text-xs sm:text-sm">
            <Clock size={14} />
            {course.duration_label || 'মেয়াদ শীঘ্রই জানানো হবে'}
          </div>
          <span className="font-stamp text-sm sm:text-base font-bold text-ink-600">৳{course.fee}</span>
        </div>

        <span className="mt-3 inline-flex items-center justify-center text-xs sm:text-sm font-semibold text-white bg-ink-600 group-hover:bg-ink-700 rounded-lg py-2 transition">
          বিস্তারিত দেখুন
        </span>
      </div>
    </Link>
  )
}
