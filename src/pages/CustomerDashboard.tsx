import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Order, Customer } from '../lib/supabase'
import { downloadInvoice } from '../lib/invoice'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { Package, FileText, User as UserIcon, LogOut, Save, CheckCircle2 } from 'lucide-react'

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}
const statusLabels: Record<string, string> = {
  pending: 'অপেক্ষমান',
  processing: 'প্রসেসিং চলছে',
  completed: 'সম্পন্ন',
  cancelled: 'বাতিল',
}

export default function CustomerDashboard({ user }: { user: any }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'orders' | 'profile'>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [{ data: ordersData }, { data: customerData }] = await Promise.all([
        supabase
          .from('orders')
          .select('*, services(name, category)')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').eq('id', user.id).maybeSingle(),
      ])

      const mapped = (ordersData || []).map((o: any) => ({
        ...o,
        service_name: o.services?.name,
        service_category: o.services?.category,
      }))
      setOrders(mapped)

      if (customerData) {
        setCustomer(customerData)
        setFullName(customerData.full_name || '')
        setPhone(customerData.phone || '')
      }
    } catch (error) {
      console.error('অ্যাকাউন্ট ডেটা লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const { error } = await supabase
        .from('customers')
        .update({ full_name: fullName, phone })
        .eq('id', user.id)
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('প্রোফাইল সেভ ত্রুটি:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSaved(false)
    if (newPassword.length < 6) {
      setPasswordError('পাসওয়ার্ড ন্যূনতম ৬ ক্যারেক্টার হতে হবে')
      return
    }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSaved(true)
      setNewPassword('')
      setTimeout(() => setPasswordSaved(false), 3000)
    } catch (error: any) {
      setPasswordError(error.message || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-charcoal">আমার অ্যাকাউন্ট</h1>
            <p className="text-charcoal/60 text-sm mt-1">{customer?.full_name || user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-seal/90 text-white px-4 py-2 rounded-lg hover:bg-seal transition text-sm font-semibold"
          >
            <LogOut size={16} />
            লগআউট
          </button>
        </div>

        <div className="flex gap-2 mb-6 border-b border-ink-100">
          <button
            onClick={() => setTab('orders')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === 'orders' ? 'border-ink-600 text-ink-700' : 'border-transparent text-charcoal/50 hover:text-charcoal'
            }`}
          >
            <Package size={16} />
            অর্ডার হিস্ট্রি
          </button>
          <button
            onClick={() => setTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === 'profile' ? 'border-ink-600 text-ink-700' : 'border-transparent text-charcoal/50 hover:text-charcoal'
            }`}
          >
            <UserIcon size={16} />
            প্রোফাইল
          </button>
        </div>

        {tab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm border border-ink-100">
            {loading ? (
              <p className="text-center text-charcoal/50 py-12">লোড করছি...</p>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Package className="mx-auto text-charcoal/20 mb-3" size={40} />
                <p className="text-charcoal/50 mb-4">আপনার এখনো কোনো অর্ডার নেই</p>
                <a href="/order" className="inline-block bg-ink-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-ink-700 transition">
                  একটি সার্ভিস অর্ডার করুন
                </a>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {orders.map((o) => (
                  <div key={o.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-charcoal">{o.service_name || 'সার্ভিস'}</p>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyles[o.status]}`}>
                          {statusLabels[o.status]}
                        </span>
                      </div>
                      <p className="text-xs text-charcoal/50 mt-1">
                        ট্র্যাকিং: {o.tracking_id} · {formatDistanceToNow(new Date(o.created_at), { addSuffix: true, locale: bn })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-ink-700">৳{o.total_amount}</span>
                      <button
                        onClick={() => downloadInvoice(o)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-800 border border-ink-200 rounded-lg px-3 py-1.5 transition"
                      >
                        <FileText size={14} />
                        ইনভয়েস
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-6 max-w-md">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-charcoal">পুরো নাম</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-ink-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-ink-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-charcoal">ফোন নম্বর</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-ink-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-ink-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-charcoal">ইমেইল</label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full border border-ink-100 rounded-lg px-4 py-2 bg-ink-50 text-charcoal/50"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-ink-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-ink-700 transition disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'সেভ করছি...' : 'সেভ করুন'}
              </button>
              {saved && (
                <p className="flex items-center gap-1.5 text-green-700 text-sm">
                  <CheckCircle2 size={16} />
                  প্রোফাইল সফলভাবে আপডেট হয়েছে
                </p>
              )}
            </form>

            <form onSubmit={handleChangePassword} className="space-y-4 mt-8 pt-6 border-t border-ink-50">
              <h3 className="font-semibold text-charcoal">পাসওয়ার্ড পরিবর্তন করুন</h3>
              {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}
              <div>
                <label className="block text-sm font-semibold mb-2 text-charcoal">নতুন পাসওয়ার্ড</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="ন্যূনতম ৬ ক্যারেক্টার"
                  className="w-full border border-ink-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-ink-400 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={passwordSaving}
                className="flex items-center gap-2 bg-charcoal text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-charcoal/90 transition disabled:opacity-50"
              >
                <Save size={16} />
                {passwordSaving ? 'পরিবর্তন করছি...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
              </button>
              {passwordSaved && (
                <p className="flex items-center gap-1.5 text-green-700 text-sm">
                  <CheckCircle2 size={16} />
                  পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
