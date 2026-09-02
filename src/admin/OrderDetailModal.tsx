import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, FileText, Copy, Check, ExternalLink } from 'lucide-react'

const paymentLabel = (m?: string) => {
  const map: Record<string, string> = {
    bkash: 'বিকাশ',
    nagad: 'নগদ',
    rocket: 'রকেট',
    cod: 'ক্যাশ অন ডেলিভারি',
  }
  return m ? map[m] || m : '-'
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
