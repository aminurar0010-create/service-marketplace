import { supabase } from './supabase'

export type AiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }

/**
 * AI গেটওয়ে (/api/ai) ডাকা। কী ব্রাউজারে নেই — সার্ভার ফাংশন Gemini-কে ডাকে।
 * কিছু ভুল হলে ok:false + বাংলা বার্তা; ডাকার জায়গা সবসময় পুরনো নিয়ম-ভিত্তিক পথে ফিরতে পারে।
 */
export async function askAI<T>(task: 'intent' | 'draft', text: string): Promise<AiResult<T>> {
  try {
    const { data: s } = await supabase.auth.getSession()
    const token = s.session?.access_token
    if (!token) return { ok: false, code: 'login', message: 'আবার লগইন করুন' }
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ task, text }),
    })
    const json = await res.json().catch(() => null)
    if (json?.ok) return { ok: true, data: json.data as T }
    return { ok: false, code: json?.code || String(res.status), message: json?.message || 'AI এই মুহূর্তে সাড়া দিচ্ছে না' }
  } catch (e) {
    console.error('AI ডাকতে ত্রুটি:', e)
    return { ok: false, code: 'network', message: 'AI-র সাথে যোগাযোগ করা যাচ্ছে না (ইন্টারনেট?)' }
  }
}

export interface AiIntent {
  intent: 'sales_summary' | 'expense_summary' | 'top_services' | 'customer_spend' | 'due_customers' | 'low_stock' | 'compare_periods' | 'unknown'
  from: string | null
  to: string | null
  name: string | null
  b_from: string | null
  b_to: string | null
}

export interface AiDraft {
  customer_name: string | null
  items: { name: string; quantity: number; price: number | null; price_kind: 'unit' | 'total' | null }[]
  paid: number | null
  method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'other' | null
  note: string | null
}
