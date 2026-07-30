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
  image_url?: string | null
  estimated_hours?: number
  urgent_fee_type?: 'fixed' | 'percentage' | null
  urgent_fee_value?: number | null
  urgent_delivery_hours?: number | null
  created_at: string
}

export interface ServiceCustomField {
  id: string
  service_id: string
  field_label: string
  field_type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox'
  options?: string[] | null
  is_required: boolean
  display_order: number
  created_at: string
}

export interface CustomFieldResponse {
  field_id: string
  label: string
  value: string
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
  is_urgent?: boolean
  urgent_fee?: number
  custom_field_responses?: CustomFieldResponse[]
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
  urgent_fee?: number
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

export interface GalleryPhoto {
  id: string
  image_url: string
  alt_text?: string | null
  display_order: number
  is_active: boolean
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

export interface Review {
  id: string
  order_id: string
  service_id?: string | null
  customer_name: string
  rating: number
  comment?: string | null
  is_approved: boolean
  created_at: string
}

export interface CashTransaction {
  id: string
  entry_date: string
  type: 'income' | 'expense'
  category: string
  description?: string | null
  amount: number
  order_id?: string | null
  created_by?: string | null
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

export interface SiteSettings {
  id: number
  site_name: string
  color_primary: string
  color_secondary: string
  color_accent: string
  color_background: string
  retention_completed_days: number
  retention_cancelled_days: number
  retention_documents_days: number
  auto_purge_enabled: boolean
  last_purge_at?: string | null
  last_purge_summary?: {
    documents_cleared: number
    cancelled_deleted: number
    completed_flagged: number
  } | null
  last_backup_at?: string | null
  last_backup_by?: string | null
  updated_at: string
  updated_by?: string | null
}

export interface ActivityLog {
  id: string
  actor_id?: string | null
  actor_name?: string | null
  action: string
  entity_type?: string | null
  entity_label?: string | null
  details?: Record<string, any> | null
  created_at: string
}

/**
 * অ্যাডমিন অ্যাক্টিভিটি লগ — যেকোনো গুরুত্বপূর্ণ অ্যাকশনের পর কল করুন।
 * ব্যর্থ হলেও মূল অ্যাকশন আটকাবে না (শুধু কনসোলে ত্রুটি দেখাবে)।
 */
export async function logActivity(
  action: string,
  entityType?: string,
  entityLabel?: string,
  details?: Record<string, any>
) {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) return

    let actorName: string | null = null
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
    actorName = profile?.full_name || null

    await supabase.from('activity_logs').insert({
      actor_id: userId,
      actor_name: actorName,
      action,
      entity_type: entityType || null,
      entity_label: entityLabel || null,
      details: details || null,
    })
  } catch (error) {
    console.error('অ্যাক্টিভিটি লগ সংরক্ষণ ত্রুটি:', error)
  }
}
