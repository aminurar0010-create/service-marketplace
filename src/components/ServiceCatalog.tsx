import { useMemo, useState } from 'react'
import { Search, X, Star } from 'lucide-react'
import { Service } from '../lib/supabase'
import ServiceCard from './ServiceCard'

const ALL = '__all__'

/** সার্চের জন্য ছোট হাতের ও বাংলা অঙ্ক → ইংরেজি অঙ্ক */
function normalize(text: string): string {
  const bn = '০১২৩৪৫৬৭৮৯'
  return text
    .toLowerCase()
    .replace(/[০-৯]/g, (d) => String(bn.indexOf(d)))
    .trim()
}

/**
 * হোমের সার্ভিস তালিকা: সার্চ বক্স + ক্যাটাগরি চিপ + "জনপ্রিয় সেবা" সবার উপরে।
 * ডাটা বিদ্যমান services থেকেই; is_popular কলাম না থাকলে জনপ্রিয় অংশ শুধু দেখায় না।
 */
export default function ServiceCatalog({ services }: { services: Service[] }) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(ALL)

  const categoryNames = useMemo(
    () => Array.from(new Set(services.map((s) => s.category || 'অন্যান্য'))).sort(),
    [services]
  )

  const q = normalize(query)
  const filtering = q !== '' || activeCategory !== ALL

  const visible = useMemo(
    () =>
      services.filter((s) => {
        const cat = s.category || 'অন্যান্য'
        if (activeCategory !== ALL && cat !== activeCategory) return false
        if (!q) return true
        return normalize(`${s.name} ${s.description || ''} ${cat}`).includes(q)
      }),
    [services, q, activeCategory]
  )

  const grouped = useMemo(() => {
    const groups: Record<string, Service[]> = {}
    for (const s of visible) {
      const cat = s.category || 'অন্যান্য'
      ;(groups[cat] ||= []).push(s)
    }
    return groups
  }, [visible])

  const groupNames = Object.keys(grouped).sort()
  const popular = useMemo(() => services.filter((s) => s.is_popular), [services])

  const chipClass = (active: boolean) =>
    `flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
      active
        ? 'bg-ink-700 text-white border-ink-700'
        : 'bg-white text-charcoal border-sage hover:border-brass'
    }`

  return (
    <div>
      {/* সার্চ বক্স */}
      <div className="relative max-w-xl mx-auto mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="সেবা খুঁজুন (যেমন: পাসপোর্ট, প্রিন্ট)"
          aria-label="সেবা খুঁজুন"
          className="w-full bg-white border border-sage rounded-full pl-11 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="সার্চ মুছুন"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ক্যাটাগরি চিপ — ফোনে অনুভূমিক স্ক্রল */}
      {categoryNames.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 sm:flex-wrap sm:justify-center sm:overflow-visible">
          <button type="button" onClick={() => setActiveCategory(ALL)} className={chipClass(activeCategory === ALL)}>
            সব
          </button>
          {categoryNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveCategory(name)}
              className={chipClass(activeCategory === name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* জনপ্রিয় সেবা — ফিল্টার/সার্চ না থাকলে সবার উপরে */}
      {!filtering && popular.length > 0 && (
        <div className="mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-5 sm:mb-8">
            <Star size={20} className="text-brass fill-brass" />
            <h3 className="text-xl sm:text-2xl font-bold text-charcoal">জনপ্রিয় সেবা</h3>
            <div className="flex-1 h-px bg-sage"></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-8">
            {popular.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-10 text-center">
          <p className="text-charcoal/60 text-lg mb-3">"{query || activeCategory}" নামে কোনো সেবা পাওয়া যায়নি</p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setActiveCategory(ALL)
            }}
            className="text-seal font-semibold text-sm hover:underline"
          >
            সব সেবা দেখুন
          </button>
        </div>
      ) : (
        <div className="space-y-12 sm:space-y-16">
          {groupNames.map((categoryName) => (
            <div key={categoryName}>
              <div className="flex items-center gap-4 mb-5 sm:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-charcoal">{categoryName}</h3>
                <div className="flex-1 h-px bg-sage"></div>
                <span className="text-sm text-charcoal/40">{grouped[categoryName].length} টি সেবা</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-8">
                {grouped[categoryName].map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
