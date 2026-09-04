import { useEffect, useState } from 'react'
import { supabase, MessageTemplate } from '../lib/supabase'
import { Save, MessageSquare } from 'lucide-react'

// এই ৬টা কী (key) — যেকোনো অর্ডারের ক্ষেত্রে সবচেয়ে বেশি দরকার হয় এমন বার্তা
const DEFAULT_TEMPLATES: { key: string; title: string; body: string }[] = [
  {
    key: 'order_received',
    title: 'অর্ডার গৃহীত',
    body: 'প্রিয় {customer_name}, আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে। ট্র্যাকিং আইডি: {tracking_id}। ধন্যবাদ — New Printers',
  },
  {
    key: 'documents_missing',
    title: 'ডকুমেন্ট বাকি',
    body: 'প্রিয় {customer_name}, আপনার {service_name} অর্ডার (ট্র্যাকিং: {tracking_id}) সম্পন্ন করতে নিচের তথ্য/ডকুমেন্ট প্রয়োজনঃ {missing_docs}। দয়া করে দ্রুত পাঠিয়ে দিন। — New Printers',
  },
  {
    key: 'processing',
    title: 'প্রক্রিয়াধীন',
    body: 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) বর্তমানে প্রক্রিয়াধীন রয়েছে। সম্পন্ন হলে জানিয়ে দেওয়া হবে। — New Printers',
  },
  {
    key: 'completed',
    title: 'সম্পন্ন',
    body: 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) সম্পন্ন হয়েছে। ধন্যবাদ — New Printers',
  },
  {
    key: 'payment_due',
    title: 'পেমেন্ট বাকি',
    body: 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) অর্ডারের ৳{amount} টাকা বাকি রয়েছে। দয়া করে পরিশোধ করুন। — New Printers',
  },
  {
    key: 'ready_for_collection',
    title: 'সংগ্রহের জন্য প্রস্তুত',
    body: 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) প্রস্তুত। অনুগ্রহ করে দোকান থেকে সংগ্রহ করুন। — New Printers',
  },
]

export default function MessageTemplatesTab() {
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('message_templates').select('*')
      if (error) throw error

      const map: Record<string, string> = {}
      DEFAULT_TEMPLATES.forEach((d) => {
        map[d.key] = d.body
      })
      ;(data as MessageTemplate[] | null)?.forEach((t) => {
        map[t.key] = t.body
      })
      setTemplates(map)
    } catch (err) {
      console.error('মেসেজ টেমপ্লেট লোড ত্রুটি:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveTemplate = async (key: string, title: string) => {
    setSavingKey(key)
    try {
      const { error } = await supabase
        .from('message_templates')
        .upsert({ key, title, body: templates[key], updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (error) throw error
    } catch (err) {
      console.error('মেসেজ টেমপ্লেট সেভ ত্রুটি:', err)
      alert('সেভ করা যায়নি')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return <p className="text-gray-400 text-sm">লোড হচ্ছে...</p>
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare size={20} /> রেডিমেড মেসেজ টেমপ্লেট
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          অর্ডার ডিটেইল থেকে গ্রাহককে এক ক্লিকে WhatsApp মেসেজ পাঠানোর সময় এই টেমপ্লেটগুলো ব্যবহার হবে।
          ব্যবহার করা যাবে এমন ভ্যারিয়েবলঃ{' '}
          <code className="bg-gray-100 px-1 rounded">{'{customer_name}'}</code>{' '}
          <code className="bg-gray-100 px-1 rounded">{'{tracking_id}'}</code>{' '}
          <code className="bg-gray-100 px-1 rounded">{'{service_name}'}</code>{' '}
          <code className="bg-gray-100 px-1 rounded">{'{amount}'}</code>{' '}
          <code className="bg-gray-100 px-1 rounded">{'{missing_docs}'}</code>
        </p>
      </div>

      <div className="space-y-4">
        {DEFAULT_TEMPLATES.map((t) => (
          <div key={t.key} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">{t.title}</h3>
              <button
                onClick={() => saveTemplate(t.key, t.title)}
                disabled={savingKey === t.key}
                className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save size={14} /> {savingKey === t.key ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
              </button>
            </div>
            <textarea
              value={templates[t.key] ?? t.body}
              onChange={(e) => setTemplates((prev) => ({ ...prev, [t.key]: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
