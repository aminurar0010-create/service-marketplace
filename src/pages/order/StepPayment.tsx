import { Tag, X, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { Service } from '../../lib/supabase'
import Field from './Field'
import PriceSummary from './PriceSummary'
import { inputCls, inputErrCls } from './ui'
import type { AppliedCoupon, FieldErrors, OrderValues } from './types'

interface StepPaymentProps {
  values: OrderValues
  errors: FieldErrors
  service: Service | undefined
  coupon: AppliedCoupon | null
  couponMessage: { text: string; ok: boolean } | null
  couponChecking: boolean
  pricing: { subtotal: number; urgentFee: number; total: number }
  onPatch: (p: Partial<OrderValues>) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void
}

export default function StepPayment(props: StepPaymentProps) {
  const { values, errors, service, coupon } = props
  const [copied, setCopied] = useState(false)
  const txnErr = errors['order-txn']

  return (
    <div>
      <h2 className="text-xl font-bold text-ink-700 mb-1">পেমেন্ট</h2>
      <p className="text-sm text-gray-500 mb-5">পেমেন্ট পদ্ধতি বেছে নিন, চাইলে কুপন ব্যবহার করুন।</p>

      <div className="mb-6">
        {service?.payment_bkash_number ? (
          <div className="bg-pink-50 border border-pink-300 rounded-lg p-4 space-y-3">
            <p className="text-sm text-pink-800">
              এই সেবার জন্য পেমেন্ট শুধুমাত্র <span className="font-semibold">বিকাশ (পার্সোনাল)</span> নম্বরে গ্রহণযোগ্য।
            </p>
            <div className="flex items-center justify-between gap-3 bg-white border border-pink-200 rounded-lg px-4 py-3">
              <div>
                <p className="text-xs text-gray-500">বিকাশ পার্সোনাল নম্বর</p>
                <p className="text-lg font-bold text-pink-700 font-mono">{service.payment_bkash_number}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(service.payment_bkash_number || '').catch(() => undefined)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="flex items-center gap-1 px-3 py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 transition flex-shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'কপি হয়েছে' : 'কপি করুন'}
              </button>
            </div>
            <p className="text-xs text-pink-700">উপরের নম্বরে "Send Money" করে নিচে ট্রানজেকশন আইডি দিন, তারপর পরবর্তী ধাপে যান।</p>
            <Field id="order-txn" label="বিকাশ ট্রানজেকশন আইডি" required error={txnErr}>
              <input
                id="order-txn"
                type="text"
                autoCapitalize="characters"
                value={values.transactionId}
                onChange={(e) => props.onPatch({ transactionId: e.target.value })}
                aria-invalid={!!txnErr}
                className={`${inputCls} uppercase ${txnErr ? inputErrCls : ''}`}
                placeholder="যেমনঃ 9G7H8J2K1L"
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3" role="radiogroup" aria-label="পেমেন্ট পদ্ধতি">
            <div className={`border rounded-lg p-4 ${values.paymentMethod === 'qr' ? 'border-ink-600 bg-ink-50' : 'border-gray-300'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="payment"
                  value="qr"
                  checked={values.paymentMethod === 'qr'}
                  onChange={(e) => props.onPatch({ paymentMethod: e.target.value })}
                  className="mt-1 w-4 h-4"
                />
                <span className="flex-1 min-w-0">
                  <span className="font-semibold">সুপার কিউআর (যেকোনো অ্যাপ দিয়ে স্ক্যান করুন)</span>
                  <span className="block text-xs text-gray-500 mt-0.5">বিকাশ, নগদ, রকেট, বা যেকোনো ব্যাংক অ্যাপ দিয়ে স্ক্যান করে পে করা যাবে</span>
                </span>
              </label>
              {values.paymentMethod === 'qr' && (
                <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3 space-y-3">
                  <img src="/payment/super-qr.png" alt="Super QR" className="w-44 h-44 mx-auto" />
                  <p className="text-center text-sm font-semibold">নিউ প্রিন্টার্স — 01968-673241</p>
                  <Field id="order-txn" label="পেমেন্ট রেফারেন্স/ট্রানজেকশন নম্বর" required error={txnErr}>
                    <input
                      id="order-txn"
                      type="text"
                      value={values.transactionId}
                      onChange={(e) => props.onPatch({ transactionId: e.target.value })}
                      aria-invalid={!!txnErr}
                      className={`${inputCls} ${txnErr ? inputErrCls : ''}`}
                      placeholder="স্ক্যানের পর পাওয়া রেফারেন্স নম্বর"
                    />
                  </Field>
                </div>
              )}
            </div>

            <label className={`flex items-center gap-3 cursor-pointer border rounded-lg p-4 ${values.paymentMethod === 'cod' ? 'border-ink-600 bg-ink-50' : 'border-gray-300'}`}>
              <input
                type="radio"
                name="payment"
                value="cod"
                checked={values.paymentMethod === 'cod'}
                onChange={(e) => props.onPatch({ paymentMethod: e.target.value })}
                className="w-4 h-4"
              />
              <span className="font-semibold">ক্যাশ অন ডেলিভারি</span>
            </label>
          </div>
        )}
      </div>

      {/* কুপন */}
      <div className="mb-6">
        <label htmlFor="order-coupon" className="block text-sm font-semibold mb-2">
          কুপন কোড (ঐচ্ছিক)
        </label>
        {coupon ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-300 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-700">{coupon.code}</span>
              <span className="text-sm text-green-700">(-৳{coupon.discount_amount} ছাড়)</span>
            </div>
            <button type="button" onClick={props.onRemoveCoupon} aria-label="কুপন সরান" className="text-gray-500 hover:text-red-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              id="order-coupon"
              type="text"
              autoCapitalize="characters"
              value={values.couponInput}
              onChange={(e) => props.onPatch({ couponInput: e.target.value.toUpperCase() })}
              onKeyDown={(e) => {
                // Enter চাপলে কুপন যাচাই হবে (পরের ধাপে যাবে না)
                if (e.key === 'Enter') {
                  e.preventDefault()
                  props.onApplyCoupon()
                }
              }}
              className={`${inputCls} flex-1 min-w-0 uppercase`}
              placeholder="কুপন কোড লিখুন"
            />
            <button
              type="button"
              onClick={props.onApplyCoupon}
              disabled={props.couponChecking || !values.couponInput.trim()}
              className="bg-gray-800 text-white px-5 py-3 rounded-lg font-semibold hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {props.couponChecking ? 'যাচাই হচ্ছে...' : 'প্রয়োগ করুন'}
            </button>
          </div>
        )}
        {props.couponMessage && (
          <p role="status" className={`text-sm mt-2 ${props.couponMessage.ok ? 'text-green-600' : 'text-red-600'}`}>
            {props.couponMessage.text}
          </p>
        )}
      </div>

      <PriceSummary service={service} subtotal={props.pricing.subtotal} coupon={coupon} isUrgent={values.isUrgent} urgentFee={props.pricing.urgentFee} total={props.pricing.total} />
    </div>
  )
}
