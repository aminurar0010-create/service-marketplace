import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'

interface StepNavProps {
  isFirst: boolean
  isLast: boolean
  loading: boolean
  loadingText: string
  onBack: () => void
}

// নিচের "পিছনে / পরবর্তী" বোতাম। "পরবর্তী" ও শেষ ধাপের "অর্ডার নিশ্চিত করুন" দুটোই ফর্মের submit —
// তাই কীবোর্ডের Enter-ও একই কাজ করে।
export default function StepNav({ isFirst, isLast, loading, loadingText, onBack }: StepNavProps) {
  return (
    <div className="flex gap-3 mt-8">
      {!isFirst && (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          পিছনে
        </button>
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex-1 flex items-center justify-center gap-2 bg-ink-600 text-white py-3 rounded-lg font-semibold hover:bg-ink-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingText}
          </>
        ) : isLast ? (
          'অর্ডার নিশ্চিত করুন'
        ) : (
          <>
            পরবর্তী
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  )
}
