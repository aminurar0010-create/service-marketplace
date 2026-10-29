import { useEffect } from 'react'
import type { ProductVariant } from '../../lib/supabase'
import type { OrderValues, StepId } from './types'

// মাঝপথে সেভ: শুধু এই ব্রাউজারের localStorage-এ; ফাইল সেভ হয় না (ব্রাউজার তা অনুমতি দেয় না)।
// ৩ দিন পর নিজে মুছে যায়; অর্ডার সফল হলে বা "নতুন করে শুরু" চাপলে সঙ্গে সঙ্গে মোছে।
const KEY = 'np_order_draft_v1'
const TTL_MS = 3 * 24 * 60 * 60 * 1000

export interface OrderDraft {
  v: 1
  savedAt: number
  step: StepId
  serviceId: string
  name: string
  phone: string
  email: string
  paymentMethod: string
  isUrgent: boolean
  customFieldValues: Record<string, string>
  variantChoices: Record<string, string> // গ্রুপ → মান
  couponInput: string
  transactionId: string
}

const STEP_IDS: StepId[] = ['service', 'details', 'documents', 'payment', 'review']

export function readDraft(): OrderDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as OrderDraft
    if (!d || d.v !== 1 || !STEP_IDS.includes(d.step)) return null
    if (typeof d.savedAt !== 'number' || Date.now() - d.savedAt > TTL_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return d
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ব্রাউজার স্টোরেজ বন্ধ থাকলে কিছু করার নেই */
  }
}

const meaningful = (v: OrderValues) => !!(v.serviceId || v.name.trim() || v.phone.trim())

export function useOrderDraft(values: OrderValues, step: StepId, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !meaningful(values)) return
    const t = setTimeout(() => {
      const variantChoices: Record<string, string> = {}
      Object.entries(values.variantByGroup).forEach(([g, v]: [string, ProductVariant]) => {
        variantChoices[g] = v.variant_value
      })
      const draft: OrderDraft = {
        v: 1,
        savedAt: Date.now(),
        step,
        serviceId: values.serviceId,
        name: values.name,
        phone: values.phone,
        email: values.email,
        paymentMethod: values.paymentMethod,
        isUrgent: values.isUrgent,
        customFieldValues: values.customFieldValues,
        variantChoices,
        couponInput: values.couponInput,
        transactionId: values.transactionId,
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(draft))
      } catch {
        /* স্টোরেজ ভরা/বন্ধ — খসড়া ছাড়াই চলবে */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [values, step, enabled])
}
