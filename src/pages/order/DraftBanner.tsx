import { History } from 'lucide-react'

interface DraftBannerProps {
  serviceName?: string
  savedAt: number
  canResume: boolean
  onResume: () => void
  onDiscard: () => void
}

export default function DraftBanner({ serviceName, savedAt, canResume, onResume, onDiscard }: DraftBannerProps) {
  const when = new Date(savedAt).toLocaleString('bn-BD', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
  return (
    <div className="mb-5 rounded-xl border border-brass-light bg-amber-50 p-4" role="status">
      <div className="flex items-start gap-3">
        <History className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900">আগের একটি অসমাপ্ত অর্ডার পাওয়া গেছে</p>
          <p className="text-sm text-amber-800 mt-0.5">
            {serviceName ? `সেবা: ${serviceName} · ` : ''}
            {when}। ডকুমেন্টের ফাইলগুলো নিরাপত্তার কারণে সেভ থাকে না — আবার বাছাই করতে হবে।
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={onResume}
              disabled={!canResume}
              className="px-4 py-2 rounded-lg bg-ink-600 text-white text-sm font-semibold hover:bg-ink-700 transition disabled:opacity-50"
            >
              {canResume ? 'চালিয়ে যান' : 'লোড হচ্ছে...'}
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="px-4 py-2 rounded-lg border border-amber-300 text-amber-900 text-sm font-semibold hover:bg-amber-100 transition"
            >
              নতুন করে শুরু করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
