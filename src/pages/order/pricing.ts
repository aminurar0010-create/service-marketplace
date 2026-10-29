import type { ProductVariant, Service } from '../../lib/supabase'
import type { AppliedCoupon } from './types'

// দামের হিসাব আগের ফর্মের সঙ্গে হুবহু এক (চূড়ান্ত হিসাব সার্ভারে হয়, এটা শুধু দেখানোর জন্য):
// সাবটোটাল = সেবার দাম + ভ্যারিয়েন্টের পার্থক্য; জরুরি ফি সাবটোটালের উপর; কুপন থাকলে কুপনের final_amount ভিত্তি।
export function calcPricing(
  service: Service | undefined,
  variantByGroup: Record<string, ProductVariant>,
  isUrgent: boolean,
  coupon: AppliedCoupon | null
) {
  const variantsDelta = Object.values(variantByGroup).reduce((sum, v) => sum + (v.price_delta || 0), 0)
  const subtotal = (service?.price || 0) + variantsDelta

  let urgentFee = 0
  if (isUrgent && service?.urgent_fee_type && service?.urgent_fee_value) {
    urgentFee =
      service.urgent_fee_type === 'percentage'
        ? Math.round((subtotal * service.urgent_fee_value) / 100)
        : service.urgent_fee_value
  }

  const base = coupon ? coupon.final_amount : subtotal
  return {
    subtotal,
    urgentFee,
    discount: coupon?.discount_amount ?? 0,
    total: base + urgentFee,
  }
}
