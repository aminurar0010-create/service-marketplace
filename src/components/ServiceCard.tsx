import { Link } from 'react-router-dom'
import { Service } from '../lib/supabase'
import { getServiceEmoji } from '../lib/serviceEmoji'

// Daraz/Chaldal-ঘরানার কমপ্যাক্ট প্রোডাক্ট কার্ড — মোবাইলে ২ কলাম পাশাপাশি বসার জন্য
// ছবি উপরে, নিচে নাম+দাম — ছোট স্ক্রিনেও ছোট, ঘন, সহজে স্ক্যান করা যায় এমন
export default function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      to={`/service/${service.id}`}
      className="group bg-white rounded-lg shadow-sm hover:shadow-md transition overflow-hidden doc-frame flex flex-col"
    >
      <div className="aspect-square sm:aspect-[4/3] overflow-hidden">
        {service.image_url ? (
          <img
            src={service.image_url}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="bg-gradient-to-br from-ink-600 to-ink-700 w-full h-full flex items-center justify-center text-3xl sm:text-5xl">
            {getServiceEmoji(service.name)}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col p-2.5 sm:p-5">
        <h3
          className="font-semibold text-charcoal text-xs leading-snug mb-1 sm:text-lg sm:font-bold sm:mb-1.5"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {service.name}
        </h3>

        <p
          className="hidden sm:block text-charcoal/60 text-sm mb-4"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {service.description}
        </p>

        <div className="mt-auto flex items-center justify-between">
          <span className="font-stamp text-sm font-bold text-ink-600 sm:text-xl">৳{service.price}</span>
          <span className="hidden sm:inline text-xs font-semibold text-seal">বিস্তারিত দেখুন</span>
        </div>
      </div>
    </Link>
  )
}
