import type { ProductVariant } from '../../lib/supabase'

// ফেজ ৫ — অর্ডার ফর্মের ধাপ: সেবা → তথ্য → ডকুমেন্ট → পেমেন্ট → নিশ্চিত
export type StepId = 'service' | 'details' | 'documents' | 'payment' | 'review'

export const STEPS: { id: StepId; label: string }[] = [
  { id: 'service', label: 'সেবা' },
  { id: 'details', label: 'তথ্য' },
  { id: 'documents', label: 'ডকুমেন্ট' },
  { id: 'payment', label: 'পেমেন্ট' },
  { id: 'review', label: 'নিশ্চিত' },
]

export interface AppliedCoupon {
  code: string
  discount_amount: number
  final_amount: number
}

export interface OrderValues {
  serviceId: string
  name: string
  phone: string
  email: string
  paymentMethod: string
  isUrgent: boolean
  customFieldValues: Record<string, string>
  variantByGroup: Record<string, ProductVariant>
  transactionId: string
  couponInput: string
  extraFiles: File[]
  requiredDocFiles: Record<string, File | null>
}

export const emptyValues = (serviceId = ''): OrderValues => ({
  serviceId,
  name: '',
  phone: '',
  email: '',
  paymentMethod: 'qr',
  isUrgent: false,
  customFieldValues: {},
  variantByGroup: {},
  transactionId: '',
  couponInput: '',
  extraFiles: [],
  requiredDocFiles: {},
})

// কী = ইনপুটের id (প্রথম ত্রুটির ঘরে ফোকাস দেওয়ার জন্য), মান = বাংলা বার্তা
export type FieldErrors = Record<string, string>

export const MAX_EXTRA_FILES = 5
