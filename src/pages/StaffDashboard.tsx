import { useEffect, useState } from 'react'
import { supabase, Order, Service, Profile, Message } from '../lib/supabase'
import { Package, Gauge, AlertTriangle, Clock, Wallet, MessageSquare, Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'

export default function StaffDashboard({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'messages'>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [adminList, setAdminList] = useState<Profile[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    fetchMessages()
    const subscription = supabase
      .channel('staff-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData()
      })
      .subscribe()

    const messagesSubscription = supabase
      .channel('staff-messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchMessages()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
      messagesSubscription.unsubscribe()
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

      const { data: adminData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .order('full_name', { ascending: true })

      setAdminList(adminData || [])
      if (adminData && adminData.length > 0) {
        setSelectedAdminId((prev) => prev || adminData[0].id)
      }
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

  const fetchMessages = async () => {
    setMessagesLoading(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('মেসেজ লোড ত্রুটি:', error)
    } finally {
      setMessagesLoading(false)
    }
  }

  const totalUnreadMessages = messages.filter(
    (m) => m.receiver_id === user.id && !m.is_read
  ).length

  const markConversationRead = async () => {
    if (!selectedAdminId) return
    const unreadIds = messages
      .filter((m) => m.sender_id === selectedAdminId && m.receiver_id === user.id && !m.is_read)
      .map((m) => m.id)

    if (unreadIds.length > 0) {
      try {
        await supabase.from('messages').update({ is_read: true }).in('id', unreadIds)
        fetchMessages()
      } catch (error) {
        console.error('মেসেজ পঠিত হিসেবে চিহ্নিত করতে ত্রুটি:', error)
      }
    }
  }

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedAdminId || sendingMessage) return
    setSendingMessage(true)
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: selectedAdminId,
        content: messageText.trim(),
        is_read: false,
      })
      if (error) throw error
      setMessageText('')
      fetchMessages()
    } catch (error) {
      console.error('মেসেজ পাঠাতে ত্রুটি:', error)
    } finally {
      setSendingMessage(false)
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

  const getDeadlineInfo = (order: Order) => {
    if (!order.deadline_at || order.status === 'completed' || order.status === 'cancelled') {
      return null
    }
    const deadline = new Date(order.deadline_at)
    const now = new Date()
    const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursLeft < 0) {
      return { label: 'মেয়াদোত্তীর্ণ', color: 'bg-red-100 text-red-800', overdue: true }
    }
    if (hoursLeft <= 6) {
      return { label: `${Math.max(0, Math.round(hoursLeft))} ঘণ্টা বাকি`, color: 'bg-orange-100 text-orange-800', overdue: false }
    }
    return {
      label: formatDistanceToNow(deadline, { locale: bn, addSuffix: true }),
      color: 'bg-gray-100 text-gray-600',
      overdue: false,
    }
  }

  const activeWorkload = orders.filter(
    (o) => o.status === 'pending' || o.status === 'processing'
  ).length

  const overdueCount = orders.filter((o) => {
    const info = getDeadlineInfo(o)
    return info?.overdue
  }).length

  const totalCommission = orders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + (o.commission_amount || 0), 0)

  useEffect(() => {
    if (activeTab === 'messages') {
      markConversationRead()
    }
  }, [activeTab, selectedAdminId, messages.length])

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

        <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-lg shadow inline-flex">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'orders' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Package size={18} />
            আমার অর্ডার
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'messages' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <MessageSquare size={18} />
            মেসেজ
            {totalUnreadMessages > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalUnreadMessages}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'orders' && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
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

          <div className={`rounded-lg shadow p-6 ${overdueCount > 0 ? 'bg-red-50' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold">মেয়াদোত্তীর্ণ অর্ডার</p>
                <p className={`text-3xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {overdueCount}
                </p>
              </div>
              <AlertTriangle className={`w-12 h-12 ${overdueCount > 0 ? 'text-red-300' : 'text-gray-200'}`} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold">মোট কমিশন (এই পর্যন্ত)</p>
                <p className="text-3xl font-bold text-green-600">৳{totalCommission}</p>
              </div>
              <Wallet className="w-12 h-12 text-green-200" />
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ডেডলাইন</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সময়</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
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
                      <td className="px-6 py-4">
                        {(() => {
                          const info = getDeadlineInfo(order)
                          if (!info) return <span className="text-gray-300 text-sm">-</span>
                          return (
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${info.color}`}>
                              {info.overdue && <AlertTriangle size={12} />}
                              {!info.overdue && <Clock size={12} />}
                              {info.label}
                            </span>
                          )
                        })()}
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

        {activeTab === 'messages' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <MessageSquare className="text-indigo-600" size={22} />
              <h2 className="text-xl font-bold">অ্যাডমিনের সাথে মেসেজ</h2>
            </div>

            <div className="flex flex-col h-[600px]">
              {adminList.length > 1 && (
                <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2">
                  <label className="text-sm text-gray-600 font-semibold">প্রাপক:</label>
                  <select
                    value={selectedAdminId || ''}
                    onChange={(e) => setSelectedAdminId(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  >
                    {adminList.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.full_name || 'অ্যাডমিন'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-gray-50">
                {!selectedAdminId ? (
                  <p className="text-center text-sm text-gray-400 mt-8">কোনো অ্যাডমিন পাওয়া যায়নি</p>
                ) : messagesLoading ? (
                  <p className="text-center text-sm text-gray-400">লোড করছি...</p>
                ) : (
                  messages
                    .filter(
                      (m) =>
                        (m.sender_id === user.id && m.receiver_id === selectedAdminId) ||
                        (m.sender_id === selectedAdminId && m.receiver_id === user.id)
                    )
                    .map((m) => (
                      <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                            m.sender_id === user.id
                              ? 'bg-indigo-600 text-white rounded-br-sm'
                              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <p className={`text-[10px] mt-1 ${m.sender_id === user.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                            {formatDistanceToNow(new Date(m.created_at), { locale: bn, addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="p-4 border-t border-gray-200 flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  disabled={!selectedAdminId}
                  placeholder="মেসেজ লিখুন..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-100"
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageText.trim() || !selectedAdminId || sendingMessage}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
