import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Service } from '../lib/supabase'
import { getServiceEmoji } from '../lib/serviceEmoji'

export default function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      to={`/service/${service.id}`}
      className="group relative flex items-center gap-3 bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden border border-ink-50 sm:flex-col sm:items-stretch sm:gap-0 sm:border-0 sm:shadow-md doc-frame"
    >
      {/* বাম পাশের ব্রাস অ্যাকসেন্ট — মোবাইলে টিকিট-স্টাবের মতো, ডেস্কটপে অদৃশ্য */}
      <span className="absolute left-0 top-0 h-full w-1 bg-brass sm:hidden" aria-hidden="true" />

      <div className="w-16 h-16 flex-shrink-0 ml-2 my-2 rounded-md overflow-hidden sm:w-full sm:h-32 sm:m-0 sm:rounded-none">
        {service.image_url ? (
          <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
        ) : (
          <div className="bg-gradient-to-br from-ink-600 to-ink-700 w-full h-full flex items-center justify-center text-2xl sm:text-5xl">
            {getServiceEmoji(service.name)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 py-2 pr-3 sm:p-5">
        <h3 className="font-semibold text-charcoal text-sm leading-snug truncate sm:text-lg sm:font-bold sm:whitespace-normal sm:mb-1.5 sm:min-h-[3rem]">
          {service.name}
        </h3>

        <p
          className="hidden sm:block text-charcoal/60 text-sm mb-4"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {service.description}
        </p>

        <div className="flex items-center justify-between sm:mt-auto">
          <span className="font-stamp text-base font-bold text-ink-600 sm:text-xl">৳{service.price}</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-seal sm:hidden">
            বিস্তারিত <ArrowRight size={12} />
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-seal group-hover:gap-1.5 transition-all">
            বিস্তারিত দেখুন <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  )
}
