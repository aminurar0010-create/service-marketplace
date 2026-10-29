import { Zap, Loader2, RefreshCw } from 'lucide-react'
import type { ProductVariant, Service } from '../../lib/supabase'
import DeliveryEstimate from '../../components/DeliveryEstimate'
import Field from './Field'
import { inputCls, inputErrCls } from './ui'
import type { FieldErrors, OrderValues } from './types'

interface StepServiceProps {
  services: Service[]
  servicesLoading: boolean
  servicesError: boolean
  onRetryServices: () => void
  values: OrderValues
  errors: FieldErrors
  selectedService: Service | undefined
  variantGroups: Record<string, ProductVariant[]>
  previewImageUrl?: string | null
  optionsLoading: boolean
  optionsError: boolean
  onRetryOptions: () => void
  onServiceChange: (id: string) => void
  onPatch: (p: Partial<OrderValues>) => void
}

export default function StepService(props: StepServiceProps) {
  const { services, values, errors, selectedService: svc, variantGroups } = props

  // ক্যাটাগরি একাধিক থাকলে সেবাগুলো ক্যাটাগরি অনুযায়ী সাজিয়ে দেখানো (লম্বা তালিকায় খোঁজা সহজ)
  const categories = Array.from(new Set(services.map((s) => s.category).filter(Boolean)))
  const renderOption = (s: Service) => (
    <option key={s.id} value={s.id}>
      {s.name} (৳{s.price})
    </option>
  )

  return (
    <div>
      <h2 className="text-xl font-bold text-ink-700 mb-1">কোন সেবা চান?</h2>
      <p className="text-sm text-gray-500 mb-5">সেবা বেছে নিন — দাম ও সময় নিচে দেখতে পাবেন।</p>

      <Field id="order-service" label="সেবা নির্বাচন করুন" required error={errors['order-service']}>
        {props.servicesLoading ? (
          <div className="flex items-center gap-2 text-gray-500 border border-gray-200 rounded-lg px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin" /> সেবার তালিকা লোড হচ্ছে...
          </div>
        ) : props.servicesError ? (
          <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">সেবার তালিকা লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।</p>
            <button type="button" onClick={props.onRetryServices} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 underline">
              <RefreshCw className="w-4 h-4" /> আবার চেষ্টা করুন
            </button>
          </div>
        ) : (
          <select
            id="order-service"
            value={values.serviceId}
            onChange={(e) => props.onServiceChange(e.target.value)}
            aria-invalid={!!errors['order-service']}
            className={`${inputCls} ${errors['order-service'] ? inputErrCls : ''}`}
          >
            <option value="">-- একটি সেবা বেছে নিন --</option>
            {categories.length > 1
              ? categories.map((c) => (
                  <optgroup key={c} label={c}>
                    {services.filter((s) => s.category === c).map(renderOption)}
                  </optgroup>
                ))
              : services.map(renderOption)}
          </select>
        )}
      </Field>

      {svc && props.optionsLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
          <Loader2 className="w-4 h-4 animate-spin" /> সেবার তথ্য লোড হচ্ছে...
        </div>
      )}
      {svc && props.optionsError && (
        <div className="mb-5 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700">এই সেবার তথ্য লোড করা যায়নি।</p>
          <button type="button" onClick={props.onRetryOptions} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 underline">
            <RefreshCw className="w-4 h-4" /> আবার চেষ্টা করুন
          </button>
        </div>
      )}

      {/* প্রোডাক্ট ছবি প্রিভিউ — ভ্যারিয়েন্ট বদলালে ছবিও বদলাবে */}
      {svc && props.previewImageUrl && (
        <div className="mb-5">
          <img src={props.previewImageUrl} alt={svc.name} className="w-full max-h-64 object-cover rounded-lg border border-gray-200" />
        </div>
      )}

      {/* ভ্যারিয়েন্ট (সাইজ/কালার ইত্যাদি) */}
      {svc && !props.optionsLoading && Object.keys(variantGroups).length > 0 && (
        <div className="mb-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">অপশন নির্বাচন করুন</p>
          {Object.entries(variantGroups).map(([group, options]) => (
            <div key={group}>
              <p className="block text-sm font-semibold mb-2">{group}</p>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                  const isSelected = values.variantByGroup[group]?.id === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => props.onPatch({ variantByGroup: { ...values.variantByGroup, [group]: option } })}
                      className={`px-4 py-2.5 rounded-lg border text-sm font-semibold transition ${
                        isSelected ? 'bg-ink-600 text-white border-ink-600' : 'bg-white text-gray-700 border-gray-300 hover:border-ink-400'
                      }`}
                    >
                      {option.variant_value}
                      {option.price_delta !== 0 && (
                        <span className={`ml-1 text-xs ${isSelected ? 'text-ink-100' : 'text-gray-400'}`}>
                          ({option.price_delta > 0 ? '+' : ''}৳{option.price_delta})
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* জরুরি ডেলিভারি — শুধু যে সেবায় urgent fee সেট করা আছে */}
      {svc?.urgent_fee_type && svc?.urgent_fee_value ? (
        <div className="mb-5">
          <label className="flex items-start gap-3 cursor-pointer bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
            <input
              type="checkbox"
              checked={values.isUrgent}
              onChange={(e) => props.onPatch({ isUrgent: e.target.checked })}
              className="w-5 h-5 mt-0.5"
            />
            <span>
              <span className="flex items-center gap-1 font-semibold text-orange-700">
                <Zap className="w-4 h-4" />
                জরুরি (Urgent) ডেলিভারি
                {svc.urgent_delivery_hours ? ` — ${svc.urgent_delivery_hours} ঘণ্টার মধ্যে` : ''}
              </span>
              <span className="block text-sm text-orange-600 mt-1">
                অতিরিক্ত ফি: {svc.urgent_fee_type === 'percentage' ? `${svc.urgent_fee_value}%` : `৳${svc.urgent_fee_value}`}
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {svc && <DeliveryEstimate estimatedHours={svc.estimated_hours} isUrgent={values.isUrgent} urgentHours={svc.urgent_delivery_hours} />}
    </div>
  )
}
