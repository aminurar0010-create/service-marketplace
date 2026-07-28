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
  assigned_staff_id?: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string
  phone: string
  role: 'admin' | 'staff'
  created_at: string
}
