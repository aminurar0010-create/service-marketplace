import { useEffect, useState } from 'react'
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

  // কোনো সক্রিয় প্রজেক্ট না থাকলে (এবং লোড শেষ হলে) পুরো সেকশনটাই লুকিয়ে রাখা হয়
  if (!loading && projects.length === 0) return null

  return (
    <section className="py-20 px-4 bg-white">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-paper rounded-lg shadow-md overflow-hidden hover:shadow-lg transition doc-frame group"
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
                <div className="p-6">
                  {p.category && (
                    <span className="inline-block bg-ink-50 text-ink-700 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                      {p.category}
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-charcoal mb-2">{p.title}</h3>
                  {p.description && (
                    <p className="text-charcoal/60 text-sm mb-4">{p.description}</p>
                  )}
                  {p.live_url && (
                    <a
                      href={p.live_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-ink-600 font-semibold text-sm hover:text-seal transition"
                    >
                      লাইভ সাইট দেখুন
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
