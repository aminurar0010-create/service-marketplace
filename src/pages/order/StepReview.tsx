import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Service, ServiceRequiredDocument } from '../../lib/supabase'
import PriceSummary from './PriceSummary'
import { usesBkash } from './validation'
import type { AppliedCoupon, OrderValues, StepId } from './types'

interface StepReviewProps {
  values: OrderValues
  service: Service | undefined
  requiredDocs: ServiceRequiredDocument[]
  coupon: AppliedCoupon | null
  pricing: { subtotal: number; urgentFee: number; total: number }
  submitError: string
  onEdit: (step: StepId) => void
}

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-700">{title}</h3>
        <button type="button" onClick={onEdit} className="text-sm font-semibold text-ink-600 hover:underline">
          বদলান
        </button>
      </div>
      <div className="text-sm text-gray-800 space-y-1 break-words">{children}</div>
    </div>
  )
}

export default function StepReview({ values, service, requiredDocs, coupon, pricing, submitError, onEdit }: StepReviewProps) {
  const variants = Object.entries(values.variantByGroup)
  const fileCount = values.extraFiles.length + requiredDocs.filter((d) => values.requiredDocFiles[d.id]).length
  const method = usesBkash(service) ? 'বিকাশ (পার্সোনাল)' : values.paymentMethod === 'cod' ? 'ক্যাশ অন ডেলিভারি' : 'সুপার কিউআর'

  return (
    <div>
      <h2 className="text-xl font-bold text-ink-700 mb-1">সব ঠিক আছে তো?</h2>
      <p className="text-sm text-gray-500 mb-5">জমা দেওয়ার আগে একবার দেখে নিন। কিছু বদলাতে "বদলান" চাপুন।</p>

      <div className="space-y-3 mb-5">
        <Section title="সেবা" onEdit={() => onEdit('service')}>
          <p className="font-semibold">{service?.name}</p>
          {variants.map(([g, v]) => (
            <p key={g}>
              {g}: {v.variant_value}
            </p>
          ))}
          {values.isUrgent && <p className="text-orange-700">জরুরি ডেলিভারি</p>}
        </Section>

        <Section title="আপনার তথ্য" onEdit={() => onEdit('details')}>
          <p>{values.name.trim()}</p>
          <p>{values.phone.trim()}</p>
          {values.email.trim() && <p>{values.email.trim()}</p>}
        </Section>

        <Section title="ডকুমেন্ট" onEdit={() => onEdit('documents')}>
          {fileCount > 0 ? <p>{fileCount}টি ফাইল আপলোডের জন্য প্রস্তুত</p> : <p className="text-gray-500">কোনো ফাইল নেই</p>}
        </Section>

        <Section title="পেমেন্ট" onEdit={() => onEdit('payment')}>
          <p>{method}</p>
          {values.transactionId.trim() && <p className="font-mono">রেফারেন্স: {values.transactionId.trim()}</p>}
        </Section>
      </div>

      <PriceSummary service={service} subtotal={pricing.subtotal} coupon={coupon} isUrgent={values.isUrgent} urgentFee={pricing.urgentFee} total={pricing.total} />

      {submitError && (
        <div role="alert" className="mt-5 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}
    </div>
  )
}
