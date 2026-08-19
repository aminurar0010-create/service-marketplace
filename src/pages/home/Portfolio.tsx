import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, PortfolioProject } from '../../lib/supabase'
import { ExternalLink, Globe } from 'lucide-react'

export default function Portfolio() {
  const [projects, setProjects] = useState<PortfolioProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_projects')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('পোর্টফোলিও লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!loading && projects.length === 0) return null

  return (
    <section id="portfolio" className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="font-stamp text-xs tracking-widest text-seal">আমাদের অভিজ্ঞতা</span>
          <h2 className="font-display text-3xl font-bold text-ink-700 mt-2">আমাদের কাজ</h2>
          <p className="text-charcoal/60 mt-3 max-w-2xl mx-auto">
            আমাদের নিজেদের তৈরি করা কিছু লাইভ ওয়েবসাইট ও ডিজিটাল প্রজেক্ট — ওয়েব ডেভেলপমেন্ট সেবার নমুনা হিসেবে।
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ink-600 mx-auto"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
            {projects.map((p) => (
              <Link
                to={`/portfolio/${p.id}`}
                key={p.id}
                className="bg-paper rounded-lg shadow-md overflow-hidden hover:shadow-lg transition doc-frame group flex flex-col"
              >
                <div className="aspect-video bg-ink-50 overflow-hidden">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Globe className="text-ink-400" size={32} />
                    </div>
                  )}
                </div>
                <div className="p-3 sm:p-6 flex flex-col flex-1">
                  {p.category && (
                    <span className="inline-block bg-ink-50 text-ink-700 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3 w-fit">
                      {p.category}
                    </span>
                  )}
                  <h3 className="text-sm sm:text-lg font-bold text-charcoal mb-1.5 sm:mb-2 line-clamp-2">{p.title}</h3>
                  {p.description && (
                    <p className="text-charcoal/60 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{p.description}</p>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-ink-600 font-semibold text-xs sm:text-sm mt-auto">
                    বিস্তারিত দেখুন
                    <ExternalLink size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
