import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, PortfolioProject } from '../lib/supabase'
import { ArrowLeft, ExternalLink, Globe } from 'lucide-react'

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<PortfolioProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data } = await supabase
          .from('portfolio_projects')
          .select('*')
          .eq('id', id)
          .eq('is_active', true)
          .maybeSingle()
        if (!data) {
          setNotFound(true)
        } else {
          setProject(data)
        }
      } catch (error) {
        console.error('প্রজেক্ট লোড ত্রুটি:', error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchProject()
  }, [id])

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-charcoal/50">লোড করছি...</div>
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
        <p className="text-charcoal/60 mb-4">এই প্রজেক্টটি খুঁজে পাওয়া যায়নি</p>
        <Link to="/" className="text-ink-600 font-semibold hover:underline">
          হোমে ফিরে যান
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-14">
      <div className="max-w-3xl mx-auto">
        <Link to="/#portfolio" className="flex items-center gap-1.5 text-sm text-ink-600 hover:underline mb-6 font-semibold">
          <ArrowLeft size={16} />
          সব প্রজেক্ট
        </Link>

        <div className="aspect-video bg-ink-50 rounded-xl overflow-hidden mb-8">
          {project.image_url ? (
            <img src={project.image_url} alt={project.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Globe className="text-ink-400" size={40} />
            </div>
          )}
        </div>

        {project.category && (
          <span className="inline-block bg-ink-50 text-ink-700 px-3 py-1 rounded-full text-xs font-semibold mb-3">
            {project.category}
          </span>
        )}

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-700 mb-4">{project.title}</h1>

        {project.description && (
          <p className="text-charcoal/70 leading-relaxed whitespace-pre-line mb-8">{project.description}</p>
        )}

        {project.live_url && (
        <a  
            href={project.live_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-ink-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-ink-700 transition"
          >
            লাইভ সাইট দেখুন
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  )
}
