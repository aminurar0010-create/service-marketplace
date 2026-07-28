import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'মিসিং Supabase credentials. কৃপয়া .env ফাইলে VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY যোগ করুন'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ডাটাবেস টাইপ ডেফিনিশন
export interface Service {
  id: string
  name: string
  description: string
  price: number
  category: string
  is_active: boolean
  estimated_hours?: number
  created_at: string
}

export interface Order {
  id: string
  tracking_id: string
  service_id: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  documents?: any[]
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  payment_method?: string
  payment_status: 'unpaid' | 'paid' | 'refunded'
  total_amount: number
  coupon_code?: string | null
  discount_amount?: number
  commission_amount?: number
  deadline_at?: string | null
  assigned_staff_id?: string
  created_at: string
  updated_at: string
}

export interface Coupon {
  id: string
  code: string
  description?: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_discount_amount?: number | null
  min_order_amount: number
  usage_limit?: number | null
  usage_limit_per_customer: number
  used_count: number
  applicable_service_ids?: string[] | null
  applicable_categories?: string[] | null
  valid_from: string
  valid_until?: string | null
  is_active: boolean
  created_at: string
}

export interface CouponValidationResult {
  valid: boolean
  message: string
  discount_amount?: number
  final_amount?: number
}

export interface CreateOrderResult {
  success: boolean
  message?: string
  tracking_id?: string
  discount_amount?: number
  final_amount?: number
}

export interface Profile {
  id: string
  full_name: string
  phone: string
  role: 'admin' | 'staff'
  specialization: string[]
  max_concurrent_orders: number
  is_available: boolean
  commission_type?: 'percentage' | 'fixed'
  commission_rate?: number
  created_at: string
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface StaffPerformance {
  staff_id: string
  full_name: string
  commission_rate: number
  commission_type: 'percentage' | 'fixed'
  completed_orders: number
  active_orders: number
  total_commission: number
  total_revenue_handled: number
  avg_completion_hours: number
}
