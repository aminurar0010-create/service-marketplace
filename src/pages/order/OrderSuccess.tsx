import { useState } from 'react'
import { CheckCircle, Copy, Check, AlertTriangle } from 'lucide-react'

interface OrderSuccessProps {
  trackingId: string
  amount: number
  warnings: string[]
  onTrack: () => void
  onNew: () => void
}

export default function OrderSuccess({ trackingId, amount, warnings, onTrack, onNew }: OrderSuccessProps) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">অর্ডার সফল!</h2>
        <p className="text-gray-600 mb-6">আপনার অর্ডার সফলভাবে তৈরি হয়েছে।</p>

        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-500 mb-2">আপনার ট্র্যাকিং নম্বর:</p>
          <p className="text-2xl font-bold text-ink-600 font-mono break-all">{trackingId}</p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(trackingId).catch(() => undefined)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:underline"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'কপি হয়েছে' : 'নম্বরটি কপি করুন'}
          </button>
        </div>

        <p className="text-gray-600 mb-2">পরিশোধযোগ্য মোট পরিমাণ:</p>
        <p className="text-xl font-bold text-gray-800 mb-6">৳{amount}</p>

        {warnings.length > 0 && (
          <div role="alert" className="text-left bg-amber-50 border border-amber-300 rounded-lg p-3 mb-6 text-sm text-amber-900">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4" /> একটি বিষয় খেয়াল করুন
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p className="mt-2">ট্র্যাকিং নম্বরসহ আমাদের জানালে আমরা ঠিক করে দেব।</p>
          </div>
        )}

        <div className="space-y-2">
          <button onClick={onTrack} className="w-full bg-ink-600 text-white py-3 rounded-lg font-semibold hover:bg-ink-700 transition">
            ট্র্যাকিং চেক করুন
          </button>
          <button onClick={onNew} className="w-full border border-ink-600 text-ink-600 py-3 rounded-lg font-semibold hover:bg-ink-50 transition">
            নতুন অর্ডার তৈরি করুন
          </button>
        </div>
      </div>
    </div>
  )
}
