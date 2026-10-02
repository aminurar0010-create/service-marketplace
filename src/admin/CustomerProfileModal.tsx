import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { X, Phone, MapPin, Hash, Package, ShoppingCart, Pencil, Save } from 'lucide-react'
import {
  supabase,
  logActivity,
  ShopCustomerSummary,
  ShopCustomerHistoryRow,
  ShopCustomerType,
  CUSTOMER_TYPE_LABELS,
} from '../lib/supabase'

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')

/** Customer 360° — একজন কাস্টমারের পূর্ণ প্রোফাইল ও Service History */
export default function CustomerProfileModal({
  customer,
  onClose,
  onChanged,
}: {
  customer: ShopCustomerSummary
  onClose: () => void
  onChanged: () => void
}) {
  const [history, setHistory] = useState<ShopCustomerHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(customer.name)
  const [address, setAddress] = useState(customer.address || '')
  const [type, setType] = useState<ShopCustomerType>(customer.customer_type)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_shop_customer_history', { p_customer_id: customer.id })
      if (error) console.error('হিস্ট্রি লোড ত্রুটি:', error)
      setHistory((data as ShopCustomerHistoryRow[]) || [])
      setLoading(false)
    })()
  }, [customer.id])

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('shop_customers')
      .update({ name: name.trim(), address: address.trim() || null, customer_type: type })
      .eq('id', customer.id)
    setSaving(false)
    if (error) {
      console.error('কাস্টমার আপডেট ত্রুটি:', error)
      return
    }
    logActivity('কাস্টমার প্রোফাইল আপডেট করা হয়েছে', 'shop_customer', name.trim())
    setEditing(false)
    onChanged()
  }

  const stats = [
    { label: 'মোট ভিজিট', value: String(customer.total_visits) },
    { label: 'মোট কাজ', value: String(customer.total_transactions) },
    { label: 'মোট খরচ', value: taka(customer.total_spent) },
    { label: 'মোট বকেয়া', value: taka(customer.total_due) },
  ]
  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full my-auto">
        <div className="flex justify-between items-start mb-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold truncate">{customer.name}</h3>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
              {CUSTOMER_TYPE_LABELS[customer.customer_type]}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-indigo-600" title="এডিট">
                <Pencil size={18} />
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3 mb-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="নাম" className={input} />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ঠিকানা" className={input} />
            <select value={type} onChange={(e) => setType(e.target.value as ShopCustomerType)} className={input}>
              {(Object.keys(CUSTOMER_TYPE_LABELS) as ShopCustomerType[]).map((t) => (
                <option key={t} value={t}>
                  {CUSTOMER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                <Save size={16} /> {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600">
                বাতিল
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 mb-4 text-sm text-gray-700">
            <p className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /> {customer.phone}</p>
            <p className="flex items-center gap-2"><Hash size={14} className="text-gray-400" /> {customer.customer_code}</p>
            {customer.address && (
              <p className="flex items-center gap-2"><MapPin size={14} className="text-gray-400" /> {customer.address}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-5">
          {stats.map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">{s.label}</p>
              <p className="font-bold text-gray-800">{s.value}</p>
            </div>
          ))}
        </div>

        <h4 className="font-semibold text-sm mb-2">Service History</h4>
        {loading ? (
          <p className="text-center text-gray-500 py-6 text-sm">লোড করছি...</p>
        ) : history.length === 0 ? (
          <p className="text-center text-gray-500 py-6 text-sm">এখনো কোনো কাজের রেকর্ড নেই</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto border border-gray-100 rounded-lg">
            {history.map((h) => (
              <li key={`${h.source}-${h.ref_no}`} className="px-3 py-2.5 flex items-start gap-3">
                {h.source === 'pos' ? (
                  <ShoppingCart size={16} className="text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <Package size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{h.title}</p>
                  <p className="text-xs text-gray-500">
                    {h.ref_no} • {format(new Date(h.created_at), 'dd/MM/yyyy')}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-800 shrink-0">{taka(h.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
