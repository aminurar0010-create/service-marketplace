import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  text: 'আসসালামু আলাইকুম! আমি নিউ প্রিন্টার্সের ডিজিটাল সহকারী। সরকারি কাগজপত্র, প্রিন্টিং বা ডিজিটাল সেবা নিয়ে কিছু জানতে চান?',
}

// ফেজ ৫ — স্মার্ট চ্যাটবট: Gemini API-ভিত্তিক, Supabase Edge Function (chat-assistant) কল করে
export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const { data, error: fnError } = await supabase.functions.invoke('chat-assistant', {
        body: {
          message: text,
          history: newMessages.slice(0, -1).map((m) => ({ role: m.role, text: m.text })),
        },
      })

      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)

      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }])
    } catch (err) {
      console.error('চ্যাটবট ত্রুটি:', err)
      setError('উত্তর আনা যায়নি। একটু পর আবার চেষ্টা করুন।')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* ফ্লোটিং চ্যাট বাটন */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-ink-700 text-white shadow-lg flex items-center justify-center hover:bg-ink-600 transition"
        aria-label="চ্যাট খুলুন"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* চ্যাট উইন্ডো */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[90vw] max-w-sm h-[70vh] max-h-[520px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          <div className="bg-ink-700 text-white px-4 py-3 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm leading-tight">নিউ প্রিন্টার্স সহকারী</p>
              <p className="text-xs text-white/70 leading-tight">সাধারণত কিছু সেকেন্ডে উত্তর দেয়</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-paper">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-ink-700 text-white rounded-br-none' : 'bg-white border border-gray-200 text-charcoal rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg rounded-bl-none px-3 py-2 flex items-center gap-2 text-sm text-charcoal/60">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  লিখছি...
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-600 text-center">{error}</p>}
          </div>

          <div className="p-2 border-t border-gray-200 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="প্রশ্ন লিখুন..."
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-600"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-9 h-9 flex-shrink-0 rounded-full bg-ink-700 text-white flex items-center justify-center disabled:opacity-40"
              aria-label="পাঠান"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
