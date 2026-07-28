import { useEffect, useState } from 'react'
import { supabase, Order, Service, Profile } from '../lib/supabase'
import { BarChart3, TrendingUp, Package, DollarSign, Users, Shield, UserCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'

export default function AdminDashboard({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'staff'>('orders')

  const [orders, setOrders] = useState<Order[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffList, setStaffList] = useState<Profile[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [staffLoading, setStaffLoading] = useState(false)
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    todayOrders: 0,
    todayRevenue: 0,
  })

  useEffect(() => {
    fetchData()
    const subscription = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'staff') {
      fetchProfiles()
    }
  }, [activeTab])

  const fetchData = async () => {
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      setOrders(ordersData || [])

      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)

      setServices(servicesData || [])

      const { data: staffData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'staff')
        .order('full_name', { ascending: true })

      setStaffList(staffData || [])

      if (ordersData) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const todayOrders = ordersData.filter((o) => new Date(o.created_at) >= today)
        const totalRevenue = ordersData.reduce((sum, o) => sum + o.total_amount, 0)
        const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total_amount, 0)

        setStats({
          totalOrders: ordersData.length,
          totalRevenue,
          todayOrders: todayOrders.length,
          todayRevenue,
        })
      }
    } catch (error) {
      console.error('ডেটা লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProfiles = async () => {
    setStaffLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProfiles(data || [])
    } catch (error) {
      console.error('প্রোফাইল লোড ত্রুটি:', error)
    } finally {
      setStaffLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
      fetchData()
    } catch (error) {
      console.error('অর্ডার আপডেট ত্রুটি:', error)
    }
  }

  const assignStaff = async (orderId: string, staffId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ assigned_staff_id: staffId || null })
        .eq('id', orderId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('স্টাফ অ্যাসাইন ত্রুটি:', error)
      alert('স্টাফ অ্যাসাইন করতে সমস্যা হয়েছে')
    }
  }

  const toggleRole = async (profileId: string, currentRole: string) => {
    if (profileId === user.id) {
      alert('নিজের role নিজে পরিবর্তন করা যাবে না')
      return
    }

    const newRole = currentRole === 'admin' ? 'staff' : 'admin'
    const confirmed = window.confirm(
      `এই ইউজারের role "${currentRole}" থেকে "${newRole}" এ পরিবর্তন করতে চান?`
    )
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId)

      if (error) throw error
      fetchProfiles()
    } catch (error) {
      console.error('Role আপডেট ত্রুটি:', error)
      alert('Role পরিবর্তন করতে সমস্যা হয়েছে')
    }
  }

  const getServiceName = (serviceId: string) => {
    return services.find((s) => s.id === serviceId)?.name || 'অজানা'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'অপেক্ষায়',
      processing: 'প্রক্রিয়াধীন',
      completed: 'সম্পন্ন',
      cancelled: 'বাতিল',
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">লোড করছি...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ড্যাশবোর্ড</h1>
          <p className="text-gray-600 mt-2">স্বাগতম, {user.email}</p>
        </div>

        {/* ট্যাব সুইচার */}
        <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-lg shadow inline-flex">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'orders'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Package size={18} />
            অর্ডার ও পরিসংখ্যান
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'staff'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={18} />
            স্টাফ ম্যানেজমেন্ট
          </button>
        </div>

        {activeTab === 'orders' && (
          <>
            {/* পরিসংখ্যান কার্ড */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">মোট অর্ডার</p>
                    <p className="text-3xl font-bold text-indigo-600">{stats.totalOrders}</p>
                  </div>
                  <Package className="w-12 h-12 text-indigo-200" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">মোট রাজস্ব</p>
                    <p className="text-3xl font-bold text-green-600">৳{stats.totalRevenue}</p>
                  </div>
                  <DollarSign className="w-12 h-12 text-green-200" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">আজকের অর্ডার</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.todayOrders}</p>
                  </div>
                  <BarChart3 className="w-12 h-12 text-blue-200" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">আজকের রাজস্ব</p>
                    <p className="text-3xl font-bold text-orange-600">৳{stats.todayRevenue}</p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-orange-200" />
                </div>
              </div>
            </div>

            {/* অর্ডার তালিকা */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold">সম্প্রতি অর্ডার</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ট্র্যাকিং ID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">গ্রাহক</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সেবা</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পরিমাণ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অবস্থা</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাসাইন করা স্টাফ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সময়</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                          কোনো অর্ডার পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-mono font-bold text-indigo-600">
                            {order.tracking_id}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div>
                              <p className="font-semibold">{order.customer_name}</p>
                              <p className="text-gray-500 text-xs">{order.customer_phone}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">{getServiceName(order.service_id)}</td>
                          <td className="px-6 py-4 text-sm font-semibold">৳{order.total_amount}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <UserCheck size={16} className="text-gray-400 flex-shrink-0" />
                              <select
                                value={order.assigned_staff_id || ''}
                                onChange={(e) => assignStaff(order.id, e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-w-[130px]"
                              >
                                <option value="">অনির্ধারিত</option>
                                {staffList.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.full_name || 'নামহীন স্টাফ'}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatDistanceToNow(new Date(order.created_at), { locale: bn, addSuffix: true })}
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            >
                              <option value="pending">অপেক্ষায়</option>
                              <option value="processing">প্রক্রিয়াধীন</option>
                              <option value="completed">সম্পন্ন</option>
                              <option value="cancelled">বাতিল</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'staff' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <Shield className="text-indigo-600" size={22} />
              <div>
                <h2 className="text-xl font-bold">স্টাফ ও অ্যাডমিন তালিকা</h2>
                <p className="text-sm text-gray-500 mt-1">
                  নতুন স্টাফ যোগ করতে হলে Supabase Authentication থেকে ইউজার তৈরি করে
                  তার UID দিয়ে profiles টেবিলে row যোগ করতে হবে।
                </p>
              </div>
            </div>

            {staffLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">লোড করছি...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">নাম</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ফোন</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">যোগদান</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          কোনো প্রোফাইল পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      profiles.map((p) => (
                        <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-semibold">
                            {p.full_name || '(নাম নেই)'}
                            {p.id === user.id && (
                              <span className="ml-2 text-xs text-indigo-600 font-normal">(আপনি)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{p.phone || '-'}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                p.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {p.role === 'admin' ? 'অ্যাডমিন' : 'স্টাফ'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatDistanceToNow(new Date(p.created_at), { locale: bn, addSuffix: true })}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => toggleRole(p.id, p.role)}
                              disabled={p.id === user.id}
                              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                            >
                              {p.role === 'admin' ? 'স্টাফ বানাও' : 'অ্যাডমিন বানাও'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
