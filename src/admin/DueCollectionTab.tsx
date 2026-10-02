import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Banknote, Search, X, History } from 'lucide-react'
import { supabase, logActivity, CustomerDue, DueCollectionRow } from '../lib/supabase'
import { PAY_METHODS, PayMethod, payMethodLabel } from './pos/posTypes'

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')

/** বাকি আদায় — কার কত বকেয়া, আদায়ের ফর্ম ও Payment History */
export default function DueCollectionTab() {
  const [dues, setDues] = useState<CustomerDue[]>([])
  const [history, setHistory] = useState<DueCollectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<CustomerDue | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayMethod>('cash')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const [d, h] = await Promise.all([
      supabase.from('customer_dues').select('*').order('oldest_due_at', { ascending: true }),
      supabase
        .from('sale_payments')
        .select('id, method, amount, created_at, pos_sales(invoice_no, customer_name, customer_phone)')
        .eq('kind', 'due_collection')
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    if (d.error) console.error('বকেয়া লোড ত্রুটি:', d.error)
    if (h.error) console.error('আদায়ের ইতিহাস লোড ত্রুটি:', h.error)
    setDues((d.data as CustomerDue[]) || [])
    setHistory((h.data as unknown as DueCollectionRow[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return dues
    return dues.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.customer_code.toLowerCase().includes(q)
    )
  }, [dues, search])

  const totalDue = dues.reduce((s, c) => s + Number(c.total_due), 0)

  const openCollect = (c: CustomerDue) => {
    setTarget(c)
    setAmount(String(c.total_due))
    setMethod('cash')
    setError('')
  }

  const submit = async () => {
    if (!target) return
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('আদায়ের পরিমাণ সঠিকভাবে দিন')
      return
    }
    setSaving(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('collect_due', {
      p_customer_id: target.customer_id,
      p_amount: value,
      p_method: method,
    })
    setSaving(false)
    if (rpcError || !data?.success) {
      setError(data?.message || 'আদায় করতে সমস্যা হয়েছে')
      if (rpcError) console.error('বাকি আদায় ত্রুটি:', rpcError)
      return
    }
    logActivity('বকেয়া আদায় করা হয়েছে', 'shop_customer', target.name, { amount: value, method })
    setTarget(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-sm font-semibold">মোট বকেয়া</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{taka(totalDue)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-sm font-semibold">বকেয়া আছে এমন কাস্টমার</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{dues.length} জন</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Banknote className="text-indigo-600" size={22} />
            <h2 className="text-xl font-bold">বাকি আদায়</h2>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="নাম / ফোন / কোড"
              className="pl-9 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-600">লোড করছি...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">কোনো বকেয়া নেই 🎉</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">কাস্টমার</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">বকেয়া</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সবচেয়ে পুরনো বাকি</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.customer_id} className="border-b border-gray-100">
                    <td className="px-6 py-3 text-sm">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        {c.phone} • {c.customer_code}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-sm font-bold text-red-600">
                      {taka(c.total_due)}
                      <span className="block text-xs font-normal text-gray-500">{c.due_sales_count}টি ইনভয়েস</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{format(new Date(c.oldest_due_at), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => openCollect(c)}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition"
                      >
                        আদায় করুন
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center gap-3">
          <History className="text-indigo-600" size={20} />
          <h3 className="font-bold">সাম্প্রতিক আদায় (শেষ ৫০টি)</h3>
        </div>
        {history.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">এখনো কোনো আদায় হয়নি</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-gray-100 text-sm">
                    <td className="px-6 py-2 text-gray-600">{format(new Date(h.created_at), 'dd/MM/yyyy hh:mm a')}</td>
                    <td className="px-6 py-2 font-medium">{h.pos_sales?.customer_name || '-'}</td>
                    <td className="px-6 py-2 text-gray-500">{h.pos_sales?.invoice_no || '-'}</td>
                    <td className="px-6 py-2 text-gray-500">{payMethodLabel(h.method)}</td>
                    <td className="px-6 py-2 font-bold text-green-600">+{taka(h.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg">{target.name}</h3>
                <p className="text-sm text-gray-500">
                  {target.phone} • মোট বকেয়া <span className="font-semibold text-red-600">{taka(target.total_due)}</span>
                </p>
              </div>
              <button onClick={() => setTarget(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">আদায়ের পরিমাণ (৳)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">পুরনো ইনভয়েস থেকে আগে কাটা হবে।</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">পেমেন্ট মেথড</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`px-3 py-1.5 rounded text-sm border transition ${
                      method === m.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={submit}
              disabled={saving}
              className="w-full py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition disabled:opacity-50"
            >
              {saving ? 'আদায় হচ্ছে...' : 'আদায় নিশ্চিত করুন'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
