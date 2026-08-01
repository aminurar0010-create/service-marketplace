import { useEffect, useState } from 'react'
import { supabase, AIPrompt, logActivity } from '../lib/supabase'
import { Sparkles, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import AIPromptFormModal from './AIPromptFormModal'

export default function AIPromptsTab() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AIPrompt | null>(null)

  useEffect(() => {
    fetchPrompts()
  }, [])

  const fetchPrompts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ai_prompts')
        .select('*')
        .order('display_order', { ascending: true })
      if (error) throw error
      setPrompts(data || [])
    } catch (error) {
      console.error('প্রম্পট লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (prompt: AIPrompt) => {
    try {
      await supabase.from('ai_prompts').update({ is_active: !prompt.is_active }).eq('id', prompt.id)
      logActivity(prompt.is_active ? 'প্রম্পট নিষ্ক্রিয় করা হয়েছে' : 'প্রম্পট সক্রিয় করা হয়েছে', 'ai_prompt', prompt.title)
      fetchPrompts()
    } catch (error) {
      console.error('স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const deletePrompt = async (prompt: AIPrompt) => {
    if (!confirm(`"${prompt.title}" প্রম্পটটি ডিলিট করতে চান?`)) return
    try {
      await supabase.from('ai_prompts').delete().eq('id', prompt.id)
      logActivity('প্রম্পট ডিলিট করা হয়েছে', 'ai_prompt', prompt.title)
      fetchPrompts()
    } catch (error) {
      console.error('ডিলিট ত্রুটি:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">AI প্রম্পট লাইব্রেরি</h2>
            <p className="text-sm text-gray-500 mt-1">গ্রাহকদের জন্য রেডিমেড AI প্রম্পট ম্যানেজ করুন</p>
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
          নতুন প্রম্পট
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-center text-gray-500 py-8">লোড করছি...</p>
        ) : prompts.length === 0 ? (
          <p className="text-center text-gray-500 py-8">কোনো প্রম্পট পাওয়া যায়নি</p>
        ) : (
          <div className="space-y-3">
            {prompts.map((p) => (
              <div key={p.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {p.category}
                      </span>
                      <p className="font-semibold text-gray-800">{p.title}</p>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {p.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </div>
                    {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(p)}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {p.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                      {p.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(p)
                        setShowModal(true)
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600"
                    >
                      <Pencil size={13} />
                      এডিট
                    </button>
                    <button
                      onClick={() => deletePrompt(p)}
                      className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={13} />
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
        <AIPromptFormModal
          prompt={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onSaved={fetchPrompts}
        />
      )}
    </div>
  )
}
