import { useEffect, useState } from 'react'
import { supabase, PortfolioProject, logActivity } from '../lib/supabase'
import { Briefcase, Plus, Pencil, Trash2, ExternalLink, Image as ImageIcon } from 'lucide-react'
import PortfolioFormModal from './PortfolioFormModal'

export default function PortfolioTab() {
  const [projects, setProjects] = useState<PortfolioProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PortfolioProject | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('portfolio_projects')
        .select('*')
        .order('display_order', { ascending: true })
      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('পোর্টফোলিও লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (p: PortfolioProject) => {
    try {
      await supabase.from('portfolio_projects').update({ is_active: !p.is_active }).eq('id', p.id)
      logActivity(p.is_active ? 'পোর্টফোলিও প্রজেক্ট নিষ্ক্রিয় করা হয়েছে' : 'পোর্টফোলিও প্রজেক্ট সক্রিয় করা হয়েছে', 'portfolio_project', p.title)
      fetchProjects()
    } catch (error) {
      console.error('স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const deleteProject = async (p: PortfolioProject) => {
    if (!confirm(`"${p.title}" প্রজেক্টটি ডিলিট করতে চান?`)) return
    try {
      await supabase.from('portfolio_projects').delete().eq('id', p.id)
      logActivity('পোর্টফোলিও প্রজেক্ট ডিলিট করা হয়েছে', 'portfolio_project', p.title)
      fetchProjects()
    } catch (error) {
      console.error('ডিলিট ত্রুটি:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Briefcase className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">আমাদের কাজ (পোর্টফোলিও)</h2>
            <p className="text-sm text-gray-500 mt-1">আগে তৈরি করা লাইভ প্রজেক্টগুলো যোগ, এডিট বা ডিলিট করুন</p>
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
          নতুন প্রজেক্ট
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-center text-gray-500 py-8">লোড করছি...</p>
        ) : projects.length === 0 ? (
          <p className="text-center text-gray-500 py-8">কোনো প্রজেক্ট পাওয়া যায়নি</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div key={p.id} className="border border-gray-200 rounded-lg overflow-hidden group relative">
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-gray-300" size={28} />
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-gray-800 text-sm truncate">{p.title}</p>
                  {p.category && <p className="text-xs text-gray-400 mt-0.5">{p.category}</p>}
                  {p.live_url && (
                    <a
                      href={p.live_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-2 truncate"
                    >
                      <ExternalLink size={12} />
                      {p.live_url.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {p.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </span>
                    <span className="text-xs text-gray-400">ক্রম: {p.display_order}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setEditing(p)
                        setShowModal(true)
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600"
                    >
                      <Pencil size={12} />
                      এডিট
                    </button>
                    <button
                      onClick={() => toggleActive(p)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {p.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                    </button>
                    <button
                      onClick={() => deleteProject(p)}
                      className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={12} />
                      ডিলিট
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <PortfolioFormModal
          project={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onSaved={fetchProjects}
        />
      )}
    </div>
  )
}
