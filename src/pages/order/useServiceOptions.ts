import { useCallback, useEffect, useState } from 'react'
import {
  supabase,
  ServiceCustomField,
  ServiceRequiredDocument,
  ProductVariant,
} from '../../lib/supabase'

interface Loaded {
  id: string
  fields: ServiceCustomField[]
  variants: ProductVariant[]
  docs: ServiceRequiredDocument[]
}

// সেবা বাছাইয়ের পর তার কাস্টম ফিল্ড, ভ্যারিয়েন্ট ও প্রয়োজনীয় ডকুমেন্ট একসঙ্গে লোড (কোয়েরি আগের মতোই)।
// আগের ফর্মে ত্রুটি চুপচাপ গিলে ফেলা হতো — ফলে নেটওয়ার্ক ঝামেলায় আবশ্যিক ঘর/ডকুমেন্ট ছাড়াই অর্ডার যেতে পারত।
// এখন ত্রুটি আলাদাভাবে জানানো হয় ও "আবার চেষ্টা" আছে। দ্রুত সেবা বদলালে পুরনো সেবার উত্তর বাতিল।
export function useServiceOptions(serviceId: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [errorFor, setErrorFor] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!serviceId) return
    let cancelled = false
    setErrorFor(null)

    Promise.all([
      supabase.from('service_custom_fields').select('*').eq('service_id', serviceId).order('display_order', { ascending: true }),
      supabase.from('product_variants').select('*').eq('service_id', serviceId).order('display_order', { ascending: true }),
      supabase.from('service_required_documents').select('*').eq('service_id', serviceId).order('display_order', { ascending: true }),
    ])
      .then(([f, v, d]) => {
        if (cancelled) return
        // ভ্যারিয়েন্ট ঐচ্ছিক — তার ত্রুটিতে অর্ডার আটকাবে না; আবশ্যিক ঘর/ডকুমেন্টের ত্রুটিতে আটকাবে
        if (f.error || d.error) {
          console.error('সেবার তথ্য লোড ত্রুটি:', f.error || d.error)
          setErrorFor(serviceId)
          return
        }
        if (v.error) console.error('ভ্যারিয়েন্ট লোড ত্রুটি:', v.error)
        setLoaded({
          id: serviceId,
          fields: (f.data || []) as ServiceCustomField[],
          variants: v.error ? [] : ((v.data || []) as ProductVariant[]),
          docs: (d.data || []) as ServiceRequiredDocument[],
        })
      })
      .catch((e) => {
        if (cancelled) return
        console.error('সেবার তথ্য লোড ত্রুটি:', e)
        setErrorFor(serviceId)
      })

    return () => {
      cancelled = true
    }
  }, [serviceId, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])

  const ready = !!serviceId && loaded?.id === serviceId
  const error = !!serviceId && errorFor === serviceId
  return {
    customFields: ready ? loaded!.fields : [],
    variants: ready ? loaded!.variants : [],
    requiredDocs: ready ? loaded!.docs : [],
    ready,
    loading: !!serviceId && !ready && !error,
    error,
    retry,
  }
}
