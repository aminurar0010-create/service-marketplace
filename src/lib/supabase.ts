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
  internal_cost?: number | null
  material_cost?: number | null
  other_cost?: number | null
  category: string
  is_active: boolean
  image_url?: string | null
  estimated_hours?: number
  urgent_fee_type?: 'fixed' | 'percentage' | null
  urgent_fee_value?: number | null
  urgent_delivery_hours?: number | null
  // সেট করা থাকলে এই সার্ভিসে শুধুমাত্র বিকাশ (পার্সোনাল) পেমেন্ট দেখানো হবে এবং ট্রানজেকশন আইডি বাধ্যতামূলক হবে
  payment_bkash_number?: string | null
  created_at: string
}

export interface MessageTemplate {
  id: string
  key: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

export interface ServiceInventoryItem {
  id: string
  service_id: string
  inventory_item_id: string
  quantity: number
  created_at: string
}

export interface ServiceRequiredDocument {
  id: string
  service_id: string
  label: string
  display_order: number
  created_at: string
}

export interface ServiceChecklistItem {
  id: string
  service_id: string
  label: string
  display_order: number
  created_at: string
}

export interface OrderChecklistItem {
  id: string
  order_id: string
  label: string
  is_checked: boolean
  display_order: number
  checked_at?: string | null
  checked_by?: string | null
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

export interface ProductVariant {
  id: string
  service_id: string
  variant_group: string
  variant_value: string
  price_delta: number
  image_url?: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

export interface SelectedVariant {
  group: string
  value: string
  price_delta: number
}

export interface CustomerOrderSummary {
  phone: string
  latest_name?: string | null
  latest_email?: string | null
  total_orders: number
  total_spent: number
  first_order_at: string
  last_order_at: string
  cancelled_orders: number
  is_blocked: boolean | null
  is_vip: boolean | null
  tags: string[] | null
  notes: string | null
}

export interface Order {
  id: string
  tracking_id: string
  service_id: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  documents?: any[]
  status: 'pending' | 'documents_pending' | 'ready' | 'processing' | 'waiting' | 'quality_check' | 'completed' | 'delivered' | 'cancelled' | 'rejected' | 'on_hold'
  priority?: 'low' | 'normal' | 'important' | 'urgent'
  inventory_deducted?: boolean
  payment_method?: string
  transaction_id?: string | null
  payment_status: 'unpaid' | 'paid' | 'refunded'
  total_amount: number
  coupon_code?: string | null
  discount_amount?: number
  commission_amount?: number
  is_urgent?: boolean
  urgent_fee?: number
  custom_field_responses?: CustomFieldResponse[]
  selected_variants?: SelectedVariant[]
  deadline_at?: string | null
  assigned_staff_id?: string
  internal_note?: string | null
  customer_id?: string | null
  service_name?: string
  service_category?: string
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
  role: 'admin' | 'staff' | 'counter_operator'
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
  payment_method?: string | null
  source?: 'manual' | 'pos' | 'due_collection' | 'online_order' | 'course_fee' | 'pos_refund' | 'ticket_cost'
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
  ga_measurement_id?: string | null
  fb_pixel_id?: string | null
  banner_enabled?: boolean
  banner_text?: string | null
  banner_link?: string | null
  notice_enabled?: boolean
  notice_text?: string | null
  contact_phone?: string | null
  contact_whatsapp?: string | null
  contact_email?: string | null
  contact_address?: string | null
  contact_facebook?: string | null
  contact_map_embed_url?: string | null
  updated_at: string
  updated_by?: string | null
}

export interface Customer {
  id: string
  full_name: string
  phone?: string | null
  email?: string | null
  is_blocked: boolean
  created_at: string
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  content: string
  cover_image_url?: string | null
  author_name?: string
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface AIPrompt {
  id: string
  title: string
  category: string
  description?: string | null
  prompt_text: string
  is_active: boolean
  display_order: number
  created_at: string
}

export interface PortfolioProject {
  id: string
  title: string
  description?: string | null
  category?: string | null
  image_url?: string | null
  live_url?: string | null
  display_order: number
  is_active: boolean
  created_at: string
}

export interface InventoryItem {
  id: string
  name: string
  sku?: string | null
  category?: string | null
  unit: string
  quantity: number
  low_stock_threshold: number
  cost_price: number
  sell_price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: string
  item_id: string
  movement_type: 'in' | 'out' | 'adjustment'
  quantity: number
  reason?: string | null
  reference_type?: string | null
  reference_id?: string | null
  created_by?: string | null
  created_at: string
}

export interface POSSale {
  id: string
  sale_number: string
  customer_name?: string | null
  customer_phone?: string | null
  payment_method: string
  subtotal: number
  discount_amount: number
  total_amount: number
  status: 'completed' | 'refunded'
  created_by?: string | null
  created_at: string
  // ফেজ B
  shop_customer_id?: string | null
  invoice_no?: string | null
  paid_amount?: number | null
  due_amount?: number | null
}

export interface SalePayment {
  id: string
  sale_id: string
  method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'other'
  amount: number
  kind: 'sale' | 'due_collection'
  created_at: string
}

export interface POSSaleItem {
  id: string
  sale_id: string
  item_type: 'service' | 'inventory' | 'custom'
  item_ref_id?: string | null
  item_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface CreatePOSSaleResult {
  success: boolean
  message?: string
  sale_id?: string
  sale_number?: string
  invoice_no?: string
  total_amount?: number
  paid_amount?: number
  due_amount?: number
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
 * বাংলাদেশি ফোন নম্বরকে wa.me লিংকের জন্য উপযুক্ত ফরম্যাটে (৮৮০ কান্ট্রি কোডসহ) রূপান্তর করে।
 * উদাহরণ: "01968673241" → "8801968673241", "+880196..." → "880196..."
 */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.startsWith('880')) return digits
  if (digits.startsWith('0')) return '880' + digits.slice(1)
  return digits
}

// ট্রেনিং কোর্স মডিউল
export interface Course {
  id: string
  title: string
  slug: string
  summary?: string | null
  description?: string | null
  duration_label?: string | null
  fee: number
  cover_image_url?: string | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface CourseModule {
  id: string
  course_id: string
  title: string
  description?: string | null
  display_order: number
  created_at: string
}

export interface Enrollment {
  id: string
  course_id: string
  full_name: string
  phone: string
  email?: string | null
  address?: string | null
  message?: string | null
  status: 'pending' | 'contacted' | 'confirmed' | 'cancelled'
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

// ===== ফেজ A — Unified Customer System =====
export type ShopCustomerType = 'regular' | 'vip' | 'student' | 'business'

export interface ShopCustomer {
  id: string
  customer_code: string
  name: string
  phone: string
  address?: string | null
  customer_type: ShopCustomerType
  auth_user_id?: string | null
  created_at: string
}

export interface ShopCustomerSummary {
  id: string
  customer_code: string
  name: string
  phone: string
  address: string | null
  customer_type: ShopCustomerType
  created_at: string
  total_orders: number
  total_pos_sales: number
  total_transactions: number
  total_visits: number
  total_spent: number
  total_due: number
  last_activity_at: string | null
}

export interface ShopCustomerHistoryRow {
  source: 'order' | 'pos' | 'enrollment'
  ref_no: string
  title: string
  amount: number
  status: string
  created_at: string
}

export const CUSTOMER_TYPE_LABELS: Record<ShopCustomerType, string> = {
  regular: 'সাধারণ',
  vip: 'VIP',
  student: 'স্টুডেন্ট',
  business: 'ব্যবসায়িক',
}

// ===== ফেজ C — Business Accounting =====
export interface CustomerDue {
  customer_id: string
  customer_code: string
  name: string
  phone: string
  total_due: number
  due_sales_count: number
  oldest_due_at: string
  last_collection_at: string | null
}

export interface DueCollectionRow {
  id: string
  method: string
  amount: number
  created_at: string
  pos_sales: { invoice_no: string | null; customer_name: string | null; customer_phone: string | null } | null
}

export interface DaySummary {
  success: boolean
  message?: string
  close_date: string
  sales_total: number
  new_due: number
  income_total: number
  expense_total: number
  net_result: number
  by_method: Record<string, { income: number; expense: number; net: number }>
}

export interface DailyClosing {
  id: string
  close_date: string
  sales_total: number
  new_due: number
  income_total: number
  expense_total: number
  net_result: number
  by_method: Record<string, { income: number; expense: number; net: number }>
  note: string | null
  created_at: string
}

// ===== ফেজ F — Training Management =====
export interface StudentOverview {
  id: string // enrollment id
  course_id: string
  course_title: string
  duration_label: string | null
  full_name: string
  phone: string
  batch_name: string | null
  start_date: string | null
  status: string
  training_status: 'running' | 'completed' | 'dropped'
  shop_customer_id: string | null
  fee_total: number
  discount: number
  net_fee: number
  paid: number
  due: number
  present_count: number
  absent_count: number
  late_count: number
  leave_count: number
  total_classes: number
  certificate_no: string | null
  certificate_date: string | null
}

export interface StudentPayment {
  id: string
  enrollment_id: string
  amount: number
  method: string
  payment_date: string
  note: string | null
  created_at: string
}
