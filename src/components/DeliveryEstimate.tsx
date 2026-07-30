import { Clock } from 'lucide-react'

interface DeliveryEstimateProps {
  estimatedHours?: number | null
  isUrgent?: boolean
  urgentHours?: number | null
}

// ফেজ ৫ — ডেলিভারি টাইম ক্যালকুলেটর: services টেবিলের estimated_hours ও
// urgent_delivery_hours (আগে থেকেই আছে) ব্যবহার করে আনুমানিক ডেলিভারি তারিখ/সময় দেখায়
export default function DeliveryEstimate({ estimatedHours, isUrgent, urgentHours }: DeliveryEstimateProps) {
  const effectiveHours = isUrgent && urgentHours ? urgentHours : estimatedHours

  if (!effectiveHours || effectiveHours <= 0) return null

  const deliverAt = new Date(Date.now() + effectiveHours * 60 * 60 * 1000)
  const dateText = deliverAt.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeText = deliverAt.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit' })

  const hoursText =
    effectiveHours < 24
      ? `প্রায় ${effectiveHours} ঘণ্টার মধ্যে`
      : `প্রায় ${Math.round(effectiveHours / 24)} দিনের মধ্যে`

  const tone = isUrgent
    ? { box: 'bg-orange-50 border-orange-200', icon: 'text-orange-600', title: 'text-orange-700', sub: 'text-orange-600' }
    : { box: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600', title: 'text-emerald-700', sub: 'text-emerald-600' }

  return (
    <div className={`mb-6 flex items-start gap-3 rounded-lg border px-4 py-3 ${tone.box}`}>
      <Clock className={`w-5 h-5 mt-0.5 flex-shrink-0 ${tone.icon}`} />
      <div>
        <p className={`font-semibold text-sm ${tone.title}`}>আনুমানিক ডেলিভারি: {hoursText}</p>
        <p className={`text-xs mt-0.5 ${tone.sub}`}>
          {dateText}, {timeText}-এর মধ্যে বুঝে পাবেন (প্রকৃত সময় কারিগরের কাজের চাপের উপর নির্ভর করতে পারে)
        </p>
      </div>
    </div>
  )
}
