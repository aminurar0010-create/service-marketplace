import { useEffect, useState } from 'react'
import { supabase, Order, Service, Profile } from '../lib/supabase'
import { Package, Gauge } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'

export default function StaffDashboard({ user }: { user: any }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const subscription = supabase
      .channel('staff-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchData = async () => {
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_staff_id', user.id)
        .order('created_at', { ascending: false })

      setOrders(ordersData || [])

      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)

      setServices(servicesData || [])

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setMyProfile(profileData)
    } catch (error) {
      console.error('ডেটা লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
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

  const activeWorkload = orders.filter(
    (o) => o.status === 'pending' || o.status === 'processing'
  ).length

  const maxOrders = myProfile?.max_concurrent_orders ?? 10
  const workloadPercent = Math.min(100, Math.round((activeWorkload / maxOrders) * 100))

  const getWorkloadColor = () => {
    if (workloadPercent >= 90) return 'text-red-600 bg-red-50'
    if (workloadPercent >= 60) return 'text-orange-600 bg-orange-50'
    return 'text-green-600 bg-green-50'
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
          <h1 className="text-3xl font-bold text-gray-900">স্টাফ ড্যাশবোর্ড</h1>
          <p className="text-gray-600 mt-2">স্বাগতম, {user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`rounded-lg shadow p-6 ${getWorkloadColor()}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold opacity-80">বর্তমান ওয়ার্কলোড</p>
                <p className="text-3xl font-bold">
                  {activeWorkload} / {maxOrders}
                </p>
                <p className="text-xs opacity-70 mt-1">অপেক্ষায় + প্রক্রিয়াধীন অর্ডার</p>
              </div>
              <Gauge className="w-12 h-12 opacity-30" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold">মোট অ্যাসাইন করা অর্ডার</p>
                <p className="text-3xl font-bold text-indigo-600">{orders.length}</p>
              </div>
              <Package className="w-12 h-12 text-indigo-200" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold">অ্যাভেইলেবিলিটি স্ট্যাটাস</p>
                <p
                  className={`text-lg font-bold mt-1 ${
                    myProfile?.is_available ?? true ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {(myProfile?.is_available ?? true) ? 'কাজ নিতে প্রস্তুত' : 'অনুপলব্ধ'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  পরিবর্তনের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200 flex items-center gap-3">
            <Package className="text-indigo-600" size={22} />
            <h2 className="text-xl font-bold">আপনার অ্যাসাইন করা অর্ডার</h2>
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সময়</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      আপনার কাছে এখনো কোনো অর্ডার অ্যাসাইন করা হয়নি
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
      </div>
    </div>
  )
}
