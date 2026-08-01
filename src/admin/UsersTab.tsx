import { useEffect, useState } from 'react'
import { supabase, Customer, logActivity } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { Users, Search, Ban, CheckCircle2 } from 'lucide-react'

export default function UsersTab() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('কাস্টমার লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleBlock = async (customer: Customer) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_blocked: !customer.is_blocked })
        .eq('id', customer.id)
      if (error) throw error
      logActivity(
        customer.is_blocked ? 'কাস্টমার আনব্লক করা হয়েছে' : 'কাস্টমার ব্লক করা হয়েছে',
        'customer',
        customer.full_name
      )
      fetchCustomers()
    } catch (error) {
      console.error('স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return c.full_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)
  })

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">রেজিস্টার্ড ইউজার</h2>
            <p className="text-sm text-gray-500 mt-1">সাইটে রেজিস্টার করা কাস্টমারদের তালিকা</p>
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

      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-500 py-12">লোড করছি...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-12">কোনো ইউজার পাওয়া যায়নি</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">নাম</th>
                <th className="text-left px-6 py-3">ফোন</th>
                <th className="text-left px-6 py-3">ইমেইল</th>
                <th className="text-left px-6 py-3">যোগদান</th>
                <th className="text-left px-6 py-3">স্ট্যাটাস</th>
                <th className="text-right px-6 py-3">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="px-6 py-3 font-semibold text-gray-800">{c.full_name}</td>
                  <td className="px-6 py-3 text-gray-600">{c.phone || '-'}</td>
                  <td className="px-6 py-3 text-gray-600">{c.email || '-'}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: bn })}
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
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => toggleBlock(c)}
                      className={`flex items-center gap-1.5 text-xs font-semibold ml-auto ${
                        c.is_blocked ? 'text-green-700 hover:text-green-900' : 'text-red-600 hover:text-red-800'
                      }`}
                    >
                      {c.is_blocked ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                      {c.is_blocked ? 'আনব্লক করুন' : 'ব্লক করুন'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
