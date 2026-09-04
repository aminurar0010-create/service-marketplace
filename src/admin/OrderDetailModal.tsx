import { useEffect, useState } from 'react'
import { supabase, toWhatsAppNumber } from '../lib/supabase'
import { X, FileText, Copy, Check, ExternalLink, ListChecks, FileWarning, MessageCircle } from 'lucide-react'

const paymentLabel = (m?: string) => {
  const map: Record<string, string> = {
    bkash: 'বিকাশ',
    nagad: 'নগদ',
    rocket: 'রকেট',
    cod: 'ক্যাশ অন ডেলিভারি',
    cash: 'ক্যাশ',
  }
  return m ? map[m] || m : '-'
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  order_received: 'প্রিয় {customer_name}, আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে। ট্র্যাকিং আইডি: {tracking_id}। ধন্যবাদ — New Printers',
  documents_missing: 'প্রিয় {customer_name}, আপনার {service_name} অর্ডার (ট্র্যাকিং: {tracking_id}) সম্পন্ন করতে নিচের তথ্য/ডকুমেন্ট প্রয়োজনঃ {missing_docs}। দয়া করে দ্রুত পাঠিয়ে দিন। — New Printers',
  processing: 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) বর্তমানে প্রক্রিয়াধীন রয়েছে। সম্পন্ন হলে জানিয়ে দেওয়া হবে। — New Printers',
  completed: 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) সম্পন্ন হয়েছে। ধন্যবাদ — New Printers',
  payment_due: 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) অর্ডারের ৳{amount} টাকা বাকি রয়েছে। দয়া করে পরিশোধ করুন। — New Printers',
  ready_for_collection: 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) প্রস্তুত। অনুগ্রহ করে দোকান থেকে সংগ্রহ করুন। — New Printers',
}

const TEMPLATE_LABELS: Record<string, string> = {
  order_received: 'অর্ডার গৃহীত',
  documents_missing: 'ডকুমেন্ট বাকি',
  processing: 'প্রক্রিয়াধীন',
  completed: 'সম্পন্ন',
  payment_due: 'পেমেন্ট বাকি',
  ready_for_collection: 'সংগ্রহের জন্য প্রস্তুত',
}

export default function OrderDetailModal({
  order,
  getServiceName,
  onClose,
}: {
  order: any
  getServiceName: (id: string) => string
  onClose: () => void
}) {
  const [docLinks, setDocLinks] = useState<Record<string, string>>({})
  const [docLoading, setDocLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checklist, setChecklist] = useState<any[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [requiredDocs, setRequiredDocs] = useState<any[]>([])
  const [templates, setTemplates] = useState<Record<string, string>>(DEFAULT_TEMPLATES)
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('order_received')
  const [messageText, setMessageText] = useState('')

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const { data, error } = await supabase.from('message_templates').select('*')
        if (error) throw error
        const map: Record<string, string> = { ...DEFAULT_TEMPLATES }
        ;(data || []).forEach((t: any) => {
          map[t.key] = t.body
        })
        setTemplates(map)
      } catch (err) {
        console.error('মেসেজ টেমপ্লেট লোড ত্রুটি:', err)
      }
    }
    loadTemplates()
  }, [])

  useEffect(() => {
    const missingLabels = requiredDocs
      .filter((rd: any) => !(order.documents || []).some((d: any) => d.label === rd.label))
      .map((rd: any) => rd.label)
      .join(', ')

    const fillPlaceholder = (str: string, key: string, value: string) => str.split(key).join(value)

    let filled = templates[selectedTemplateKey] || ''
    filled = fillPlaceholder(filled, '{customer_name}', order.customer_name || '')
    filled = fillPlaceholder(filled, '{tracking_id}', order.tracking_id || '')
    filled = fillPlaceholder(filled, '{service_name}', getServiceName(order.service_id))
    filled = fillPlaceholder(filled, '{amount}', String(order.total_amount ?? ''))
    filled = fillPlaceholder(filled, '{missing_docs}', missingLabels || 'কোনো তথ্য বাকি নেই')

    setMessageText(filled)
  }, [selectedTemplateKey, templates, order, requiredDocs, getServiceName])

  useEffect(() => {
    const loadRequiredDocs = async () => {
      try {
        const { data, error } = await supabase
          .from('service_required_documents')
          .select('*')
          .eq('service_id', order.service_id)
          .order('display_order', { ascending: true })
        if (error) throw error
        setRequiredDocs(data || [])
      } catch (err) {
        console.error('প্রয়োজনীয় ডকুমেন্ট লোড ত্রুটি:', err)
      }
    }
    loadRequiredDocs()
  }, [order])

  useEffect(() => {
    const loadDocs = async () => {
      if (!order.documents || order.documents.length === 0) return
      setDocLoading(true)
      const links: Record<string, string> = {}
      for (const doc of order.documents) {
        try {
          const { data, error } = await supabase.storage
            .from('order-documents')
            .createSignedUrl(doc.path, 60 * 30) // ৩০ মিনিটের জন্য ভ্যালিড লিংক
          if (!error && data?.signedUrl) {
            links[doc.path] = data.signedUrl
          }
        } catch (err) {
          console.error('ডকুমেন্ট লিংক তৈরি ত্রুটি:', err)
        }
      }
      setDocLinks(links)
      setDocLoading(false)
    }
    loadDocs()
  }, [order])

  // অর্ডারের চেকলিস্ট লোড করুন — প্রথমবার খোলা হলে সার্ভিস টেমপ্লেট থেকে কপি করে
  // order_checklist_items এ বসিয়ে দেয় (একবারই, তারপর নিজস্ব প্রোগ্রেস হিসেবে থাকে)
  useEffect(() => {
    const loadChecklist = async () => {
      setChecklistLoading(true)
      try {
        const { data: existing, error: existingError } = await supabase
          .from('order_checklist_items')
          .select('*')
          .eq('order_id', order.id)
          .order('display_order', { ascending: true })
        if (existingError) throw existingError

        if (existing && existing.length > 0) {
          setChecklist(existing)
          return
        }

        const { data: template, error: templateError } = await supabase
          .from('service_checklist_items')
          .select('*')
          .eq('service_id', order.service_id)
          .order('display_order', { ascending: true })
        if (templateError) throw templateError

        if (!template || template.length === 0) {
          setChecklist([])
          return
        }

        const insertPayload = template.map((t: any) => ({
          order_id: order.id,
          label: t.label,
          display_order: t.display_order,
        }))
        const { data: inserted, error: insertError } = await supabase
          .from('order_checklist_items')
          .insert(insertPayload)
          .select('*')
        if (insertError) throw insertError
        setChecklist((inserted || []).sort((a: any, b: any) => a.display_order - b.display_order))
      } catch (err) {
        console.error('চেকলিস্ট লোড ত্রুটি:', err)
      } finally {
        setChecklistLoading(false)
      }
    }
    loadChecklist()
  }, [order])

  const toggleChecklistItem = async (item: any) => {
    const newValue = !item.is_checked
    setChecklist((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, is_checked: newValue } : c))
    )
    try {
      await supabase
        .from('order_checklist_items')
        .update({ is_checked: newValue, checked_at: newValue ? new Date().toISOString() : null })
        .eq('id', item.id)
    } catch (err) {
      console.error('চেকলিস্ট আপডেট ত্রুটি:', err)
    }
  }

  const checkedCount = checklist.filter((c) => c.is_checked).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold">অর্ডার বিস্তারিত — {order.tracking_id}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs text-gray-500">সেবা</p>
            <p className="font-semibold">{getServiceName(order.service_id)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">গ্রাহকের নাম</p>
              <p className="font-semibold">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">মোবাইল</p>
              <p className="font-semibold">{order.customer_phone}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">পেমেন্ট মেথড</p>
              <p className="font-semibold">{paymentLabel(order.payment_method)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">মোট পরিমাণ</p>
              <p className="font-semibold">৳{order.total_amount}</p>
            </div>
          </div>

          {order.transaction_id && (
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-pink-700">বিকাশ ট্রানজেকশন আইডি</p>
                <p className="font-mono font-bold text-pink-800">{order.transaction_id}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(order.transaction_id)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="flex items-center gap-1 px-2 py-1 bg-pink-600 text-white text-xs font-semibold rounded hover:bg-pink-700 transition"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'কপি হয়েছে' : 'কপি'}
              </button>
            </div>
          )}

          {order.custom_field_responses && order.custom_field_responses.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">অতিরিক্ত তথ্য</p>
              <div className="space-y-2">
                {order.custom_field_responses.map((f: any, idx: number) => (
                  <div key={idx} className="flex justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                    <span className="text-gray-600">{f.label}</span>
                    <span className="font-semibold">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.internal_note && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700 font-semibold mb-1">ইন্টারনাল নোট</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{order.internal_note}</p>
            </div>
          )}

          {order.customer_phone && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <MessageCircle size={15} /> গ্রাহককে মেসেজ পাঠান
                </p>
                <select
                  value={selectedTemplateKey}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                >
                  {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
              />
              <a
                href={`https://wa.me/${toWhatsAppNumber(order.customer_phone)}?text=${encodeURIComponent(messageText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-green-700 transition"
              >
                <MessageCircle size={15} /> WhatsApp-এ পাঠান
              </a>
            </div>
          )}

          {requiredDocs.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <FileWarning size={15} /> প্রয়োজনীয় ডকুমেন্ট
              </p>
              <div className="space-y-1.5">
                {requiredDocs.map((rd: any) => {
                  const received = (order.documents || []).some((d: any) => d.label === rd.label)
                  return (
                    <div
                      key={rd.id}
                      className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
                        received ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <span>{rd.label}</span>
                      <span className={`text-xs font-semibold ${received ? 'text-green-700' : 'text-red-700'}`}>
                        {received ? '✓ পাওয়া গেছে' : '✗ বাকি আছে'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {checklistLoading ? (
            <p className="text-sm text-gray-400">চেকলিস্ট লোড হচ্ছে...</p>
          ) : checklist.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <ListChecks size={15} /> প্রসেসিং চেকলিস্ট
                </p>
                <span className="text-xs text-gray-500">
                  {checkedCount}/{checklist.length} সম্পন্ন
                </span>
              </div>
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                  >
                    <input
                      type="checkbox"
                      checked={!!item.is_checked}
                      onChange={() => toggleChecklistItem(item)}
                      className="w-4 h-4"
                    />
                    <span className={item.is_checked ? 'line-through text-gray-400' : ''}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">আপলোড করা ডকুমেন্ট</p>
            {!order.documents || order.documents.length === 0 ? (
              <p className="text-sm text-gray-400">কোনো ডকুমেন্ট আপলোড করা হয়নি</p>
            ) : docLoading ? (
              <p className="text-sm text-gray-400">লোড হচ্ছে...</p>
            ) : (
              <div className="space-y-2">
                {order.documents.map((doc: any, idx: number) => (
                  <a
                    key={idx}
                    href={docLinks[doc.path] || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded px-3 py-2 text-sm transition"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FileText size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">{doc.name}</span>
                    </span>
                    <ExternalLink size={14} className="text-indigo-600 flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
