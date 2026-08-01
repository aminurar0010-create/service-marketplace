import { useEffect, useMemo, useState } from 'react'
import { supabase, AIPrompt } from '../lib/supabase'
import { Sparkles, Copy, Check } from 'lucide-react'

export default function PromptLibrary() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('সব')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const { data } = await supabase
          .from('ai_prompts')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
        setPrompts(data || [])
      } catch (error) {
        console.error('প্রম্পট লোড ত্রুটি:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPrompts()
  }, [])

  const categories = useMemo(() => ['সব', ...Array.from(new Set(prompts.map((p) => p.category)))], [prompts])
  const filtered = category === 'সব' ? prompts : prompts.filter((p) => p.category === category)

  const handleCopy = async (prompt: AIPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text)
      setCopiedId(prompt.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('কপি ত্রুটি:', error)
    }
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-14">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-ink-600 rounded-full flex items-center justify-center text-white mx-auto mb-4">
            <Sparkles size={22} />
          </div>
          <h1 className="text-3xl font-display font-bold text-charcoal">AI প্রম্পট লাইব্রেরি</h1>
          <p className="text-charcoal/60 mt-2">নির্দিষ্ট কাজের জন্য রেডিমেড প্রম্পট — এক ক্লিকে কপি করুন</p>
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  category === c ? 'bg-ink-600 text-white' : 'bg-white text-charcoal/60 border border-ink-100 hover:border-ink-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-center text-charcoal/50 py-12">লোড করছি...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-charcoal/50 py-12">কোনো প্রম্পট পাওয়া যায়নি</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-ink-100 p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="inline-block bg-ink-50 text-ink-700 text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2">
                      {p.category}
                    </span>
                    <h2 className="font-display font-bold text-charcoal">{p.title}</h2>
                  </div>
                </div>
                {p.description && <p className="text-sm text-charcoal/60 mb-3">{p.description}</p>}
                <div className="bg-ink-50/60 rounded-lg p-3 text-sm text-charcoal/80 font-mono whitespace-pre-wrap mb-3 max-h-40 overflow-y-auto">
                  {p.prompt_text}
                </div>
                <button
                  onClick={() => handleCopy(p)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-800 transition"
                >
                  {copiedId === p.id ? <Check size={15} /> : <Copy size={15} />}
                  {copiedId === p.id ? 'কপি হয়েছে!' : 'প্রম্পট কপি করুন'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
