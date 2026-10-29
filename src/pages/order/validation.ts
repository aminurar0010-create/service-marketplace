import type { Service, ServiceCustomField, ServiceRequiredDocument } from '../../lib/supabase'
import { isValidPhone } from '../../lib/phone'
import { STEPS, type FieldErrors, type OrderValues, type StepId } from './types'

export interface ValidationContext {
  values: OrderValues
  service: Service | undefined
  customFields: ServiceCustomField[]
  requiredDocs: ServiceRequiredDocument[]
  optionsLoading: boolean
  optionsError: boolean
}

// বিকাশ-অনলি সার্ভিসে (payment_bkash_number সেট) পেমেন্ট মেথড বিকাশে লক থাকে
export const usesBkash = (service: Service | undefined) => !!service?.payment_bkash_number

// ফর্মের নিয়ম আগের মতোই — শুধু বার্তা alert-এর বদলে সংশ্লিষ্ট ঘরের নিচে দেখানো হয়।
export function validateStep(step: StepId, ctx: ValidationContext): FieldErrors {
  const { values, service, customFields, requiredDocs } = ctx
  const errors: FieldErrors = {}

  if (step === 'service') {
    if (!values.serviceId || !service) {
      errors['order-service'] = 'একটি সেবা বেছে নিন'
    } else if (ctx.optionsLoading) {
      errors['order-service'] = 'সেবার তথ্য লোড হচ্ছে, একটু অপেক্ষা করুন'
    } else if (ctx.optionsError) {
      errors['order-service'] = 'সেবার তথ্য লোড করা যায়নি। "আবার চেষ্টা করুন" চাপুন'
    }
  }

  if (step === 'details') {
    if (!values.name.trim()) errors['order-name'] = 'আপনার সম্পূর্ণ নাম লিখুন'
    if (!values.phone.trim()) {
      errors['order-phone'] = 'ফোন নম্বর দিন'
    } else if (!isValidPhone(values.phone)) {
      errors['order-phone'] = 'সঠিক ১১ অঙ্কের মোবাইল নম্বর দিন (যেমন 01XXXXXXXXX)'
    }
    if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      errors['order-email'] = 'ইমেইলটি সঠিক নয় (অথবা ঘরটি খালি রাখুন)'
    }
    for (const field of customFields) {
      if (field.is_required && !values.customFieldValues[field.id]?.trim()) {
        errors[`order-cf-${field.id}`] = `"${field.field_label}" পূরণ করুন`
      }
    }
  }

  if (step === 'documents') {
    for (const doc of requiredDocs) {
      if (!values.requiredDocFiles[doc.id]) {
        errors[`order-doc-${doc.id}`] = `"${doc.label}" আপলোড করুন`
      }
    }
  }

  if (step === 'payment') {
    if (usesBkash(service)) {
      if (!values.transactionId.trim()) errors['order-txn'] = 'বিকাশ ট্রানজেকশন আইডি দিন'
    } else if (values.paymentMethod === 'qr' && !values.transactionId.trim()) {
      errors['order-txn'] = 'পেমেন্ট রেফারেন্স/ট্রানজেকশন নম্বর দিন'
    }
  }

  return errors
}

// সাবমিটের আগে সব ধাপ আবার দেখা — ধাপ এড়িয়ে (ট্যাবে ট্যাপ করে বা খসড়া থেকে) এলেও ফাঁক থাকবে না।
export function validateAll(ctx: ValidationContext): { step: StepId; errors: FieldErrors } | null {
  for (const s of STEPS) {
    if (s.id === 'review') continue
    const errors = validateStep(s.id, ctx)
    if (Object.keys(errors).length > 0) return { step: s.id, errors }
  }
  return null
}
