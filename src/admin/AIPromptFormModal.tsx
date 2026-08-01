import { useState } from 'react'
import { supabase, AIPrompt, logActivity } from '../lib/supabase'
import { X, Loader2 } from 'lucide-react'

export default function AIPromptFormModal({
  prompt,
  onClose,
  onSaved,
}: {
  prompt: AIPrompt | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!prompt
  const [title, setTitle] = useState(prompt?.title || '')
  const [category, setCategory] = useState(prompt?.category || 'সাধারণ')
  const [description, setDescription] = useState(prompt?.description || '')
  const [promptText, setPromptText] = useState(prompt?.prompt_text || '')
  const [displayOrder, setDisplayOrder] = useState(prompt?.display_order ?? 0)
  const [isActive, setIsActive] = useState(prompt?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (!title.trim() || !promptText.trim()) {
      setError('শিরোনাম ও প্রম্পট টেক্সট আবশ্যক')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        category: category.trim() || 'সাধারণ',
        description: description.trim() || null,
        prompt_text: promptText.trim(),
        display_order: displayOrder,
        is_active: isActive,
      }

      if (isEditing) {
        const { error: updateError } = await supabase.from('ai_prompts').update(payload).eq('id', prompt!.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('ai_prompts').insert(payload)
        if (insertError) throw insertError
      }

      logActivity(isEditing ? 'প্রম্পট আপডেট করা হয়েছে' : 'নতুন প্রম্পট যোগ করা হয়েছে', 'ai_prompt', payload.title)
      onSaved()
      onClose()
    } catch (err) {
      console.error('প্রম্পট সংরক্ষণ ত্রুটি:', err)
      setError('সংরক্ষণ করতে সমস্যা হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">{isEditing ? 'প্রম্পট এডিট করুন' : 'নতুন প্রম্পট যোগ করুন'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">শিরোনাম *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">ক্যাটাগরি</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="যেমনঃ কনটেন্ট রাইটিং"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">সংক্ষিপ্ত বিবরণ</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">প্রম্পট টেক্সট *</label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">ক্রম (Order)</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            সক্রিয় (লাইব্রেরিতে দেখানো হবে)
          </label>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
            বাতিল
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            সংরক্ষণ করুন
          </button>
        </div>
      </div>
    </div>
  )
}
