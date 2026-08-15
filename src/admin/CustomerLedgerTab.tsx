import { useEffect, useState } from 'react'
import { supabase, CustomerOrderSummary, logActivity } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { BookUser, Search, Ban, CheckCircle2, Star, X, Save } from 'lucide-react'

export default function CustomerLedgerTab() {
  const [customers, setCustomers] = useState<CustomerOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingCustomer, setEditingCustomer] = useState<CustomerOrderSummary | null>(null)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customer_order_summary')
        .select('*')
        .order('last_order_at', { ascending: false })

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('কাস্টমার খাতা লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleBlock = async (customer: CustomerOrderSummary) => {
    try {
      const { error } = await supabase.rpc('upsert_customer_ledger', {
        p_phone: customer.phone,
        p_full_name: customer.latest_name,
        p_email: customer.latest_email,
        p_is_blocked: !customer.is_blocked,
      })
      if (error) throw error
      logActivity(
        customer.is_blocked ? 'কাস্টমার আনব্লক করা হয়েছে' : 'কাস্টমার ব্লক করা হয়েছে',
        'customer_ledger',
        customer.latest_name || customer.phone
      )
      fetchCustomers()
    } catch (error) {
      console.error('স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.latest_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.latest_email?.toLowerCase().includes(q)
    )
  })

  const totalCustomers = customers.length
  const vipCount = customers.filter((c) => c.is_vip).length
  const blockedCount = customers.filter((c) => c.is_blocked).length

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookUser className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">কাস্টমার খাতা</h2>
            <p className="text-sm text-gray-500 mt-1">
              সব কাস্টমারের (গেস্ট + রেজিস্টার্ড) অর্ডার হিস্ট্রি, মোট খরচ ও নোট এক জায়গায়
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম, ফোন বা ইমেইল খুঁজুন"
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="p-6 border-b border-gray-100 grid grid-cols-3 gap-4">
        <div className="bg-indigo-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{totalCustomers}</p>
          <p className="text-xs text-gray-500 mt-1">মোট কাস্টমার</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{vipCount}</p>
          <p className="text-xs text-gray-500 mt-1">VIP কাস্টমার</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{blockedCount}</p>
          <p className="text-xs text-gray-500 mt-1">ব্লকড</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-500 py-12">লোড করছি...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-12">কোনো কাস্টমার পাওয়া যায়নি</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">নাম / ফোন</th>
                <th className="text-left px-6 py-3">মোট অর্ডার</th>
                <th className="text-left px-6 py-3">মোট খরচ</th>
                <th className="text-left px-6 py-3">শেষ অর্ডার</th>
                <th className="text-left px-6 py-3">স্ট্যাটাস</th>
                <th className="text-right px-6 py-3">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.phone}>
                  <td className="px-6 py-3">
                    <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                      {c.is_vip && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                      {c.latest_name || '—'}
                    </p>
                    <p className="text-gray-500 text-xs">{c.phone}</p>
                  </td>
                  <td className="px-6 py-3 text-gray-700">
                    {c.total_orders}
                    {c.cancelled_orders > 0 && (
                      <span className="text-xs text-red-500 ml-1">({c.cancelled_orders} বাতিল)</span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-semibold text-gray-800">
                    ৳{(c.total_spent || 0).toLocaleString('bn-BD')}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {formatDistanceToNow(new Date(c.last_order_at), { addSuffix: true, locale: bn })}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        c.is_blocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {c.is_blocked ? 'ব্লকড' : 'সক্রিয়'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => setEditingCustomer(c)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      বিস্তারিত
                    </button>
                    <button
                      onClick={() => toggleBlock(c)}
                      className={`text-xs font-semibold ${
                        c.is_blocked ? 'text-green-700 hover:text-green-900' : 'text-red-600 hover:text-red-800'
                      }`}
                    >
                      {c.is_blocked ? <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" /> : <Ban className="inline w-3.5 h-3.5 mr-1" />}
                      {c.is_blocked ? 'আনব্লক' : 'ব্লক'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingCustomer && (
        <CustomerDetailModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={fetchCustomers}
        />
      )}
    </div>
  )
}

function CustomerDetailModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerOrderSummary
  onClose: () => void
  onSaved: () => void
}) {
  const [isVip, setIsVip] = useState(customer.is_vip || false)
  const [notes, setNotes] = useState(customer.notes || '')
  const [tagsInput, setTagsInput] = useState((customer.tags || []).join(', '))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('upsert_customer_ledger', {
        p_phone: customer.phone,
        p_full_name: customer.latest_name,
        p_email: customer.latest_email,
        p_is_vip: isVip,
        p_tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        p_notes: notes.trim() || null,
      })
      if (error) throw error
      logActivity('কাস্টমার খাতা আপডেট করা হয়েছে', 'customer_ledger', customer.latest_name || customer.phone)
      onSaved()
      onClose()
    } catch (error) {
      console.error('কাস্টমার খাতা সেভ ত্রুটি:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full my-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{customer.latest_name || customer.phone}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500 text-xs mb-1">মোট অর্ডার</p>
            <p className="font-bold text-gray-800">{customer.total_orders}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500 text-xs mb-1">মোট খরচ</p>
            <p className="font-bold text-gray-800">৳{(customer.total_spent || 0).toLocaleString('bn-BD')}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 col-span-2">
            <p className="text-gray-500 text-xs mb-1">যোগাযোগ</p>
            <p className="font-semibold text-gray-800">{customer.phone}</p>
            {customer.latest_email && <p className="text-gray-500 text-xs">{customer.latest_email}</p>}
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} className="w-4 h-4" />
            <span className="font-semibold flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-500" /> VIP কাস্টমার হিসেবে চিহ্নিত করুন
            </span>
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">ট্যাগ (কমা দিয়ে আলাদা করুন)</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="যেমন: নিয়মিত, পাইকারি"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">নোট</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="এই কাস্টমার সম্পর্কে অভ্যন্তরীণ নোট লিখুন"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
        </button>
      </div>
    </div>
  )
}
