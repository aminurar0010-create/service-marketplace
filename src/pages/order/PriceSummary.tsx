import type { Service } from '../../lib/supabase'
import type { AppliedCoupon } from './types'

interface PriceSummaryProps {
  service: Service | undefined
  subtotal: number
  coupon: AppliedCoupon | null
  isUrgent: boolean
  urgentFee: number
  total: number
}

// পেমেন্ট ও নিশ্চিত ধাপে একই সারসংক্ষেপ (আগের ফর্মের "মূল্য সারসংক্ষেপ" বক্স, হুবহু একই হিসাব)
export default function PriceSummary({ service, subtotal, coupon, isUrgent, urgentFee, total }: PriceSummaryProps) {
  if (!service) return null
  return (
    <div className="bg-ink-50 p-4 rounded-lg space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-gray-600">সাবটোটাল:</span>
        <span className="font-semibold">৳{subtotal}</span>
      </div>
      {coupon && (
        <div className="flex justify-between items-center text-green-600">
          <span>ছাড় ({coupon.code}):</span>
          <span className="font-semibold">-৳{coupon.discount_amount}</span>
        </div>
      )}
      {isUrgent && urgentFee > 0 && (
        <div className="flex justify-between items-center text-orange-600">
          <span>জরুরি ফি:</span>
          <span className="font-semibold">+৳{urgentFee}</span>
        </div>
      )}
      <div className="flex justify-between items-center border-t border-ink-100 pt-2">
        <span className="font-semibold">মোট পরিমাণ (আনুমানিক):</span>
        <span className="text-2xl font-bold text-ink-600">৳{total}</span>
      </div>
    </div>
  )
}
