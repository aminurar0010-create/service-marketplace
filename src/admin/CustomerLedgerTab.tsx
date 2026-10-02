import { useEffect, useState } from 'react'
import {
  supabase,
  CustomerOrderSummary,
  ShopCustomerSummary,
  CUSTOMER_TYPE_LABELS,
  logActivity,
} from '../lib/supabase'
import { normalizePhone } from '../lib/phone'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { BookUser, Search, Ban, CheckCircle2, Star, X, Save, UserPlus } from 'lucide-react'
import { CustomerCreateForm } from '../components/CustomerPicker'
import CustomerProfileModal from './CustomerProfileModal'

// shop_customer_summary (সব কাস্টমার) + পুরনো খাতা (VIP/ব্লক/ট্যাগ/নোট) একসাথে
interface LedgerRow {
  key: string
  profile: ShopCustomerSummary | null // null = শুধু পুরনো খাতায় আছে (ফোন অসম্পূর্ণ)
  legacy: CustomerOrderSummary | null
  name: string
  phone: string
  code: string
  totalOrders: number
  totalSpent: number
  lastAt: string | null
}

export default function CustomerLedgerTab() {
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingCustomer, setEditingCustomer] = useState<CustomerOrderSummary | null>(null)
  const [profileFor, setProfileFor] = useState<ShopCustomerSummary | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const [summaryRes, legacyRes] = await Promise.all([
        supabase.from('shop_customer_summary').select('*'),
        supabase.from('customer_order_summary').select('*'),
      ])
      if (summaryRes.error) throw summaryRes.error

      const legacyByPhone = new Map<string, CustomerOrderSummary>()
      ;((legacyRes.data as CustomerOrderSummary[]) || []).forEach((l) => legacyByPhone.set(normalizePhone(l.phone), l))

      const merged: LedgerRow[] = ((summaryRes.data as ShopCustomerSummary[]) || []).map((p) => {
        const legacy = legacyByPhone.get(p.phone) || null
        legacyByPhone.delete(p.phone)
        return {
          key: p.id,
          profile: p,
          legacy,
          name: p.name,
          phone: p.phone,
          code: p.customer_code,
          totalOrders: p.total_transactions,
          totalSpent: Number(p.total_spent || 0),
          lastAt: p.last_activity_at,
        }
      })
      // শুধু পুরনো খাতায় আছে এমন (ফোন নম্বর অসম্পূর্ণ) — হারিয়ে যেতে দেওয়া হয় না
      legacyByPhone.forEach((l) =>
        merged.push({
          key: 'legacy-' + l.phone,
          profile: null,
          legacy: l,
          name: l.latest_name || '',
          phone: l.phone,
          code: '',
          totalOrders: l.total_orders,
          totalSpent: Number(l.total_spent || 0),
          lastAt: l.last_order_at,
        })
      )
      merged.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))
      setRows(merged)
    } catch (error) {
      console.error('কাস্টমার খাতা লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  // পুরনো খাতার সারি (VIP/ব্লক/নোট সেভ করার জন্য) — না থাকলে নতুন কাস্টমারের তথ্য থেকে বানানো হয়
  const legacyOf = (r: LedgerRow): CustomerOrderSummary =>
    r.legacy || {
      phone: r.phone,
      latest_name: r.name,
      latest_email: null,
      total_orders: r.totalOrders,
      total_spent: r.totalSpent,
      first_order_at: r.profile?.created_at || new Date().toISOString(),
      last_order_at: r.lastAt || new Date().toISOString(),
      cancelled_orders: 0,
      is_blocked: false,
      is_vip: false,
      tags: [],
      notes: null,
    }

  const toggleBlock = async (r: LedgerRow) => {
    const customer = legacyOf(r)
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

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const digits = normalizePhone(q)
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      (digits.length >= 3 && r.phone.includes(digits)) ||
      r.legacy?.latest_email?.toLowerCase().includes(q)
    )
  })

  const totalCustomers = rows.length
  const vipCount = rows.filter((r) => r.legacy?.is_vip || r.profile?.customer_type === 'vip').length
  const blockedCount = rows.filter((r) => r.legacy?.is_blocked).length

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookUser className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">কাস্টমার খাতা</h2>
            <p className="text-sm text-gray-500 mt-1">
              অনলাইন ও দোকানের সব কাস্টমার — ফোন নম্বর ধরে এক প্রোফাইলে
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="নাম, ফোন বা কাস্টমার কোড"
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 whitespace-nowrap"
          >
            <UserPlus size={16} /> নতুন
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="p-6 border-b border-gray-100 max-w-md">
          <CustomerCreateForm
            onCancel={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false)
              fetchCustomers()
            }}
          />
        </div>
      )}

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
                <th className="text-left px-6 py-3">মোট কাজ</th>
                <th className="text-left px-6 py-3">মোট খরচ</th>
                <th className="text-left px-6 py-3">শেষ কাজ</th>
                <th className="text-left px-6 py-3">স্ট্যাটাস</th>
                <th className="text-right px-6 py-3">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const blocked = !!r.legacy?.is_blocked
                const vip = !!r.legacy?.is_vip || r.profile?.customer_type === 'vip'
                return (
                  <tr key={r.key}>
                    <td className="px-6 py-3">
                      <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                        {vip && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        {r.name || '—'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {r.phone}
                        {r.code && ` • ${r.code}`}
                        {r.profile && r.profile.customer_type !== 'regular' && r.profile.customer_type !== 'vip' &&
                          ` • ${CUSTOMER_TYPE_LABELS[r.profile.customer_type]}`}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-gray-700">
                      {r.totalOrders}
                      {!!r.legacy?.cancelled_orders && r.legacy.cancelled_orders > 0 && (
                        <span className="text-xs text-red-500 ml-1">({r.legacy.cancelled_orders} বাতিল)</span>
                      )}
                    </td>
                    <td className="px-6 py-3 font-semibold text-gray-800">
                      ৳{r.totalSpent.toLocaleString('bn-BD')}
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {r.lastAt ? formatDistanceToNow(new Date(r.lastAt), { addSuffix: true, locale: bn }) : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          blocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {blocked ? 'ব্লকড' : 'সক্রিয়'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right space-x-3 whitespace-nowrap">
                      {r.profile && (
                        <button
                          onClick={() => setProfileFor(r.profile)}
                          className="text-xs font-semibold text-green-700 hover:text-green-900"
                        >
                          প্রোফাইল
                        </button>
                      )}
                      <button
                        onClick={() => setEditingCustomer(legacyOf(r))}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        নোট/ট্যাগ
                      </button>
                      <button
                        onClick={() => toggleBlock(r)}
                        className={`text-xs font-semibold ${
                          blocked ? 'text-green-700 hover:text-green-900' : 'text-red-600 hover:text-red-800'
                        }`}
                      >
                        {blocked ? <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" /> : <Ban className="inline w-3.5 h-3.5 mr-1" />}
                        {blocked ? 'আনব্লক' : 'ব্লক'}
                      </button>
                    </td>
                  </tr>
                )
              })}
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

      {profileFor && (
        <CustomerProfileModal
          customer={profileFor}
          onClose={() => setProfileFor(null)}
          onChanged={fetchCustomers}
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
