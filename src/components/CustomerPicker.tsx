import { useEffect, useState } from 'react'
import { Search, UserPlus, X, Check, Loader2 } from 'lucide-react'
import {
  supabase,
  logActivity,
  ShopCustomer,
  ShopCustomerType,
  CUSTOMER_TYPE_LABELS,
} from '../lib/supabase'
import { normalizePhone, isValidPhone } from '../lib/phone'

interface Props {
  value: ShopCustomer | null
  onChange: (customer: ShopCustomer | null) => void
  autoFocus?: boolean
}

/** ফোন/নাম/কাস্টমার কোড দিয়ে খোঁজে; না পেলে নতুন কাস্টমার তৈরির ফর্ম দেখায়। */
export default function CustomerPicker({ value, onChange, autoFocus }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ShopCustomer[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const digits = normalizePhone(q)
        const safe = q.replace(/[%,()]/g, ' ')
        const filters = [`name.ilike.%${safe}%`, `customer_code.ilike.%${safe}%`]
        if (digits.length >= 3) filters.push(`phone.like.%${digits}%`)
        const { data, error } = await supabase
          .from('shop_customers')
          .select('*')
          .or(filters.join(','))
          .order('created_at', { ascending: false })
          .limit(8)
        if (error) throw error
        setResults((data as ShopCustomer[]) || [])
      } catch (e) {
        console.error('কাস্টমার সার্চ ত্রুটি:', e)
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const select = (c: ShopCustomer) => {
    onChange(c)
    setQuery('')
    setResults([])
    setCreating(false)
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 truncate">{value.name}</p>
          <p className="text-xs text-gray-500">
            {value.phone} • {value.customer_code}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-gray-400 hover:text-red-500 shrink-0"
          title="কাস্টমার বদলান"
        >
          <X size={18} />
        </button>
      </div>
    )
  }

  const typedPhone = normalizePhone(query)
  const exactExists = results.some((r) => r.phone === typedPhone)
  const canCreate = isValidPhone(query) && !exactExists && !searching

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCreating(false)
          }}
          inputMode="search"
          placeholder="মোবাইল নম্বর, নাম বা কাস্টমার কোড"
          className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" size={16} />
        )}
      </div>

      {(results.length > 0 || canCreate) && !creating && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {results.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => select(c)}
              className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 border-b border-gray-100 last:border-b-0"
            >
              <p className="text-sm font-semibold text-gray-800">{c.name}</p>
              <p className="text-xs text-gray-500">
                {c.phone} • {c.customer_code} • {CUSTOMER_TYPE_LABELS[c.customer_type]}
              </p>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 flex items-center gap-2"
            >
              <UserPlus size={16} /> নতুন কাস্টমার তৈরি করুন ({typedPhone})
            </button>
          )}
        </div>
      )}

      {creating && (
        <CustomerCreateForm
          initialPhone={typedPhone}
          onCancel={() => setCreating(false)}
          onCreated={select}
        />
      )}
    </div>
  )
}

export function CustomerCreateForm({
  initialPhone = '',
  onCancel,
  onCreated,
}: {
  initialPhone?: string
  onCancel: () => void
  onCreated: (c: ShopCustomer) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(initialPhone)
  const [address, setAddress] = useState('')
  const [type, setType] = useState<ShopCustomerType>('regular')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    if (!name.trim()) return setError('নাম লিখুন')
    if (!isValidPhone(phone)) return setError('সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)')
    setSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const { data, error: insErr } = await supabase
        .from('shop_customers')
        .insert({
          name: name.trim(),
          phone: normalizePhone(phone),
          address: address.trim() || null,
          customer_type: type,
          created_by: sessionData.session?.user?.id ?? null,
        })
        .select('*')
        .single()

      if (insErr) {
        // একই ফোন আগে থেকে থাকলে সেটাই নিয়ে নিন
        if (insErr.code === '23505') {
          const { data: existing } = await supabase
            .from('shop_customers')
            .select('*')
            .eq('phone', normalizePhone(phone))
            .maybeSingle()
          if (existing) return onCreated(existing as ShopCustomer)
        }
        throw insErr
      }
      logActivity('নতুন কাস্টমার তৈরি করা হয়েছে', 'shop_customer', data.name)
      onCreated(data as ShopCustomer)
    } catch (e) {
      console.error('কাস্টমার তৈরি ত্রুটি:', e)
      setError('কাস্টমার সেভ করা যায়নি, আবার চেষ্টা করুন')
    } finally {
      setSaving(false)
    }
  }

  const input =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="mt-2 border border-green-200 bg-green-50/50 rounded-lg p-4 space-y-3">
      <p className="text-sm font-bold text-green-800 flex items-center gap-2">
        <UserPlus size={16} /> নতুন কাস্টমার
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="নাম *" className={input} autoFocus />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        placeholder="মোবাইল নম্বর *"
        className={input}
      />
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ঠিকানা (ঐচ্ছিক)" className={input} />
      <select value={type} onChange={(e) => setType(e.target.value as ShopCustomerType)} className={input}>
        {(Object.keys(CUSTOMER_TYPE_LABELS) as ShopCustomerType[]).map((t) => (
          <option key={t} value={t}>
            {CUSTOMER_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          <Check size={16} /> {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          বাতিল
        </button>
      </div>
    </div>
  )
}
