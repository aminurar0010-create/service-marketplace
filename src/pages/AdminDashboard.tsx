import { useEffect, useState } from 'react'
import { supabase, Order, Service, Profile, Coupon, StaffPerformance, Message } from '../lib/supabase'
import { BarChart3, TrendingUp, Package, DollarSign, Users, Shield, UserCheck, Settings, X, Wand2, Ticket, Plus, Trash2, Pencil, AlertTriangle, Clock, Award, MessageSquare, Send, Download, Layers } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'

export default function AdminDashboard({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'services' | 'staff' | 'coupons' | 'performance' | 'messages'>('orders')

  const [orders, setOrders] = useState<Order[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffList, setStaffList] = useState<Profile[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [performance, setPerformance] = useState<StaffPerformance[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [staffLoading, setStaffLoading] = useState(false)
  const [couponsLoading, setCouponsLoading] = useState(false)
  const [performanceLoading, setPerformanceLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [bulkStaffId, setBulkStaffId] = useState('')
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    todayOrders: 0,
    todayRevenue: 0,
    overdueOrders: 0,
  })

  useEffect(() => {
    fetchData()
    fetchMessages()
    const subscription = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData()
      })
      .subscribe()

    const messagesSubscription = supabase
      .channel('admin-messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchMessages()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
      messagesSubscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'staff') {
      fetchProfiles()
    }
    if (activeTab === 'coupons') {
      fetchCoupons()
    }
    if (activeTab === 'performance') {
      fetchPerformance()
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
        .order('category', { ascending: true })

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
        const now = new Date()

        const todayOrders = ordersData.filter((o) => new Date(o.created_at) >= today)
        const totalRevenue = ordersData.reduce((sum, o) => sum + o.total_amount, 0)
        const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total_amount, 0)
        const overdueOrders = ordersData.filter(
          (o) =>
            o.deadline_at &&
            o.status !== 'completed' &&
            o.status !== 'cancelled' &&
            new Date(o.deadline_at) < now
        ).length

        setStats({
          totalOrders: ordersData.length,
          totalRevenue,
          todayOrders: todayOrders.length,
          todayRevenue,
          overdueOrders,
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

  const getUnreadCount = (staffId: string) =>
    messages.filter((m) => m.sender_id === staffId && m.receiver_id === user.id && !m.is_read).length

  const totalUnreadMessages = staffList.reduce((sum, s) => sum + getUnreadCount(s.id), 0)

  const selectStaffConversation = async (staffId: string) => {
    setSelectedStaffId(staffId)
    const unreadIds = messages
      .filter((m) => m.sender_id === staffId && m.receiver_id === user.id && !m.is_read)
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
    if (!messageText.trim() || !selectedStaffId || sendingMessage) return
    setSendingMessage(true)
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: selectedStaffId,
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

  const fetchPerformance = async () => {
    setPerformanceLoading(true)
    try {
      const { data, error } = await supabase
        .from('staff_performance')
        .select('*')
        .order('total_commission', { ascending: false })

      if (error) throw error
      setPerformance(data || [])
    } catch (error) {
      console.error('পারফরম্যান্স লোড ত্রুটি:', error)
    } finally {
      setPerformanceLoading(false)
    }
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

  const fetchCoupons = async () => {
    setCouponsLoading(true)
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCoupons(data || [])
    } catch (error) {
      console.error('কুপন লোড ত্রুটি:', error)
    } finally {
      setCouponsLoading(false)
    }
  }

  const toggleCouponActive = async (coupon: Coupon) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !coupon.is_active })
        .eq('id', coupon.id)

      if (error) throw error
      fetchCoupons()
    } catch (error) {
      console.error('কুপন স্ট্যাটাস আপডেট ত্রুটি:', error)
      alert('কুপন স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে')
    }
  }

  const deleteCoupon = async (coupon: Coupon) => {
    const confirmed = window.confirm(`"${coupon.code}" কুপনটি স্থায়ীভাবে মুছে ফেলতে চান?`)
    if (!confirmed) return

    try {
      const { error } = await supabase.from('coupons').delete().eq('id', coupon.id)
      if (error) throw error
      fetchCoupons()
    } catch (error) {
      console.error('কুপন ডিলিট ত্রুটি:', error)
      alert('কুপন মুছতে সমস্যা হয়েছে। সম্ভবত এই কুপনটি ইতিমধ্যে কোনো অর্ডারে ব্যবহৃত হয়েছে।')
    }
  }

  const toggleServiceActive = async (service: Service) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !service.is_active })
        .eq('id', service.id)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('সার্ভিস স্ট্যাটাস আপডেট ত্রুটি:', error)
      alert('সার্ভিস স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে')
    }
  }

  const deleteService = async (service: Service) => {
    const confirmed = window.confirm(`"${service.name}" সার্ভিসটি স্থায়ীভাবে মুছে ফেলতে চান?`)
    if (!confirmed) return

    try {
      const { error } = await supabase.from('services').delete().eq('id', service.id)
      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('সার্ভিস ডিলিট ত্রুটি:', error)
      alert('সার্ভিস মুছতে সমস্যা হয়েছে। সম্ভবত এই সার্ভিসে ইতিমধ্যে অর্ডার আছে।')
    }
  }

  const isCouponExpired = (coupon: Coupon) => {
    return !!coupon.valid_until && new Date(coupon.valid_until) < new Date()
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

  const autoAssignStaff = async (orderId: string) => {
    setAssigningOrderId(orderId)
    try {
      const { error } = await supabase.rpc('auto_assign_order', {
        p_order_id: orderId,
      })

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('অটো অ্যাসাইন ত্রুটি:', error)
      alert('অটো অ্যাসাইন করতে সমস্যা হয়েছে')
    } finally {
      setAssigningOrderId(null)
    }
  }

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    )
  }

  const toggleSelectAllOrders = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([])
    } else {
      setSelectedOrderIds(orders.map((o) => o.id))
    }
  }

  const clearSelection = () => {
    setSelectedOrderIds([])
    setBulkStaffId('')
    setBulkStatus('')
  }

  const bulkAssignStaff = async () => {
    if (!bulkStaffId || selectedOrderIds.length === 0) return
    setBulkProcessing(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ assigned_staff_id: bulkStaffId })
        .in('id', selectedOrderIds)

      if (error) throw error
      clearSelection()
      fetchData()
    } catch (error) {
      console.error('বাল্ক অ্যাসাইন ত্রুটি:', error)
      alert('বাল্ক স্টাফ অ্যাসাইন করতে সমস্যা হয়েছে')
    } finally {
      setBulkProcessing(false)
    }
  }

  const bulkUpdateStatus = async () => {
    if (!bulkStatus || selectedOrderIds.length === 0) return
    setBulkProcessing(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: bulkStatus })
        .in('id', selectedOrderIds)

      if (error) throw error
      clearSelection()
      fetchData()
    } catch (error) {
      console.error('বাল্ক স্ট্যাটাস আপডেট ত্রুটি:', error)
      alert('বাল্ক স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে')
    } finally {
      setBulkProcessing(false)
    }
  }

  const exportSelectedCSV = () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id))
    if (selectedOrders.length === 0) return

    const headers = ['ট্র্যাকিং ID', 'গ্রাহকের নাম', 'ফোন', 'সেবা', 'পরিমাণ', 'অবস্থা', 'পেমেন্ট', 'ডেডলাইন', 'তৈরির সময়']
    const rows = selectedOrders.map((o) => [
      o.tracking_id,
      o.customer_name,
      o.customer_phone,
      getServiceName(o.service_id),
      o.total_amount,
      getStatusLabel(o.status),
      o.payment_status,
      o.deadline_at || '',
      o.created_at,
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `orders-export-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'services'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Layers size={18} />
            সার্ভিস ম্যানেজমেন্ট
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
          <button
            onClick={() => setActiveTab('coupons')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'coupons'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Ticket size={18} />
            কুপন ম্যানেজমেন্ট
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'performance'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Award size={18} />
            কমিশন ও পারফরম্যান্স
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'messages'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
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
            {/* পরিসংখ্যান কার্ড */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
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

              <div className={`rounded-lg shadow p-6 ${stats.overdueOrders > 0 ? 'bg-red-50' : 'bg-white'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">মেয়াদোত্তীর্ণ অর্ডার</p>
                    <p className={`text-3xl font-bold ${stats.overdueOrders > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {stats.overdueOrders}
                    </p>
                  </div>
                  <AlertTriangle className={`w-12 h-12 ${stats.overdueOrders > 0 ? 'text-red-300' : 'text-gray-200'}`} />
                </div>
              </div>
            </div>

            {/* অর্ডার তালিকা */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold">সম্প্রতি অর্ডার</h2>
              </div>

              {selectedOrderIds.length > 0 && (
                <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-indigo-700 whitespace-nowrap">
                    {selectedOrderIds.length}টি অর্ডার সিলেক্ট করা হয়েছে
                  </span>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={bulkStaffId}
                      onChange={(e) => setBulkStaffId(e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="">স্টাফ নির্বাচন করুন</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || 'নামহীন স্টাফ'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={bulkAssignStaff}
                      disabled={!bulkStaffId || bulkProcessing}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      <UserCheck size={14} />
                      বাল্ক অ্যাসাইন
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="">স্ট্যাটাস নির্বাচন করুন</option>
                      <option value="pending">অপেক্ষায়</option>
                      <option value="processing">প্রক্রিয়াধীন</option>
                      <option value="completed">সম্পন্ন</option>
                      <option value="cancelled">বাতিল</option>
                    </select>
                    <button
                      onClick={bulkUpdateStatus}
                      disabled={!bulkStatus || bulkProcessing}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      <Pencil size={14} />
                      বাল্ক স্ট্যাটাস
                    </button>
                  </div>

                  <button
                    onClick={exportSelectedCSV}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-sm font-semibold rounded hover:bg-gray-50 transition whitespace-nowrap"
                  >
                    <Download size={14} />
                    CSV এক্সপোর্ট
                  </button>

                  <button
                    onClick={clearSelection}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition whitespace-nowrap ml-auto"
                  >
                    <X size={14} />
                    সিলেকশন বাতিল
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                          onChange={toggleSelectAllOrders}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ট্র্যাকিং ID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">গ্রাহক</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সেবা</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পরিমাণ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অবস্থা</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ডেডলাইন</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাসাইন করা স্টাফ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সময়</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                          কোনো অর্ডার পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.includes(order.id)}
                              onChange={() => toggleSelectOrder(order.id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
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
                              <button
                                onClick={() => autoAssignStaff(order.id)}
                                disabled={assigningOrderId === order.id}
                                title="সিস্টেম অটোমেটিক সবচেয়ে কম-ব্যস্ত স্টাফকে অ্যাসাইন করবে"
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 whitespace-nowrap"
                              >
                                <Wand2 size={14} />
                                {assigningOrderId === order.id ? 'হচ্ছে...' : 'অটো'}
                              </button>
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

        {activeTab === 'services' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Layers className="text-indigo-600" size={22} />
                <div>
                  <h2 className="text-xl font-bold">সার্ভিস তালিকা</h2>
                  <p className="text-sm text-gray-500 mt-1">সার্ভিস অ্যাড, এডিট বা ডিলিট করুন</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingService(null)
                  setShowServiceModal(true)
                }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
              >
                <Plus size={16} />
                নতুন সার্ভিস
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">নাম</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ক্যাটাগরি</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">দাম</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্ট্যাটাস</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        কোনো সার্ভিস পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    services.map((s) => (
                      <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">
                          <p className="font-semibold">{s.name}</p>
                          {s.description && (
                            <p className="text-gray-500 text-xs mt-0.5">{s.description}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{s.category}</td>
                        <td className="px-6 py-4 text-sm font-semibold">৳{s.price}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              s.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {s.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setEditingService(s)
                                setShowServiceModal(true)
                              }}
                              className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-indigo-600"
                            >
                              <Pencil size={14} />
                              এডিট
                            </button>
                            <button
                              onClick={() => toggleServiceActive(s)}
                              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              {s.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                            </button>
                            <button
                              onClick={() => deleteService(s)}
                              className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={14} />
                              ডিলিট
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্পেশালাইজেশন</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সর্বোচ্চ অর্ডার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Available</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">যোগদান</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
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
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {p.specialization && p.specialization.length > 0
                              ? p.specialization.join(', ')
                              : <span className="text-gray-400">সব ধরনের কাজ</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {p.max_concurrent_orders ?? 10}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                p.is_available
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {p.is_available ? 'হ্যাঁ' : 'না'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatDistanceToNow(new Date(p.created_at), { locale: bn, addSuffix: true })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setEditingProfile(p)}
                                className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-indigo-600"
                              >
                                <Settings size={14} />
                                এডিট
                              </button>
                              <button
                                onClick={() => toggleRole(p.id, p.role)}
                                disabled={p.id === user.id}
                                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                              >
                                {p.role === 'admin' ? 'স্টাফ বানাও' : 'অ্যাডমিন বানাও'}
                              </button>
                            </div>
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

        {activeTab === 'coupons' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Ticket className="text-indigo-600" size={22} />
                <div>
                  <h2 className="text-xl font-bold">কুপন তালিকা</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    ডিসকাউন্ট কুপন তৈরি, এডিট ও নিষ্ক্রিয় করুন
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingCoupon(null)
                  setShowCouponModal(true)
                }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
              >
                <Plus size={16} />
                নতুন কুপন
              </button>
            </div>

            {couponsLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">লোড করছি...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">কোড</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ছাড়</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সর্বনিম্ন অর্ডার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ব্যবহার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">মেয়াদ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্ট্যাটাস</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          কোনো কুপন পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      coupons.map((c) => {
                        const expired = isCouponExpired(c)
                        return (
                          <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm">
                              <p className="font-mono font-bold text-indigo-600">{c.code}</p>
                              {c.description && (
                                <p className="text-gray-500 text-xs mt-0.5">{c.description}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold">
                              {c.discount_type === 'percentage' ? `${c.discount_value}%` : `৳${c.discount_value}`}
                              {c.discount_type === 'percentage' && c.max_discount_amount && (
                                <p className="text-gray-500 text-xs font-normal">
                                  সর্বোচ্চ ৳{c.max_discount_amount}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">৳{c.min_order_amount}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {c.used_count}
                              {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                              <p className="text-gray-500 text-xs">প্রতি গ্রাহক: {c.usage_limit_per_customer}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {c.valid_until
                                ? new Date(c.valid_until).toLocaleDateString('bn-BD')
                                : 'সীমাহীন'}
                            </td>
                            <td className="px-6 py-4">
                              {expired ? (
                                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                  মেয়াদোত্তীর্ণ
                                </span>
                              ) : (
                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                    c.is_active
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {c.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => {
                                    setEditingCoupon(c)
                                    setShowCouponModal(true)
                                  }}
                                  className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-indigo-600"
                                >
                                  <Pencil size={14} />
                                  এডিট
                                </button>
                                <button
                                  onClick={() => toggleCouponActive(c)}
                                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                >
                                  {c.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                                </button>
                                <button
                                  onClick={() => deleteCoupon(c)}
                                  className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-800"
                                >
                                  <Trash2 size={14} />
                                  ডিলিট
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <Award className="text-indigo-600" size={22} />
              <div>
                <h2 className="text-xl font-bold">কমিশন ও পারফরম্যান্স</h2>
                <p className="text-sm text-gray-500 mt-1">
                  কমিশন রেট পরিবর্তন করতে "কমিশন এডিট"-এ ক্লিক করুন (স্টাফ প্রোফাইল এডিট থেকে)
                </p>
              </div>
            </div>

            {performanceLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">লোড করছি...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্টাফ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">কমিশন রেট</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সম্পন্ন অর্ডার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">চলমান অর্ডার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পরিচালিত রাজস্ব</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">মোট কমিশন</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">গড় সম্পন্ন সময়</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                          কোনো স্টাফ পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      performance.map((p) => (
                        <tr key={p.staff_id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-semibold">{p.full_name || 'নামহীন স্টাফ'}</td>
                          <td className="px-6 py-4 text-sm">
                            {p.commission_type === 'percentage'
                              ? `${p.commission_rate}%`
                              : `৳${p.commission_rate}`}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-green-700">{p.completed_orders}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{p.active_orders}</td>
                          <td className="px-6 py-4 text-sm">৳{p.total_revenue_handled}</td>
                          <td className="px-6 py-4 text-sm font-bold text-indigo-600">৳{p.total_commission}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {p.avg_completion_hours > 0 ? `${p.avg_completion_hours} ঘণ্টা` : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                const staffProfile = profiles.find((pr) => pr.id === p.staff_id) || staffList.find((pr) => pr.id === p.staff_id)
                                if (staffProfile) {
                                  setEditingProfile(staffProfile)
                                } else {
                                  alert('প্রোফাইল খুঁজে পেতে আগে "স্টাফ ম্যানেজমেন্ট" ট্যাবে একবার যান')
                                }
                              }}
                              className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-indigo-600"
                            >
                              <Pencil size={14} />
                              কমিশন এডিট
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

        {activeTab === 'messages' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <MessageSquare className="text-indigo-600" size={22} />
              <h2 className="text-xl font-bold">ইন্টারনাল মেসেজিং</h2>
            </div>

            <div className="flex h-[600px]">
              {/* স্টাফ লিস্ট */}
              <div className="w-72 border-r border-gray-200 overflow-y-auto">
                {staffList.length === 0 ? (
                  <p className="p-6 text-center text-sm text-gray-500">কোনো স্টাফ পাওয়া যায়নি</p>
                ) : (
                  staffList.map((staff) => {
                    const unread = getUnreadCount(staff.id)
                    const staffMessages = messages.filter(
                      (m) => m.sender_id === staff.id || m.receiver_id === staff.id
                    )
                    const lastMessage = staffMessages[staffMessages.length - 1]
                    return (
                      <button
                        key={staff.id}
                        onClick={() => selectStaffConversation(staff.id)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition flex items-start gap-3 ${
                          selectedStaffId === staff.id ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {(staff.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm truncate">{staff.full_name || 'নামহীন স্টাফ'}</p>
                            {unread > 0 && (
                              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center flex-shrink-0">
                                {unread}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {lastMessage ? lastMessage.content : 'কোনো মেসেজ নেই'}
                          </p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              {/* চ্যাট প্যানেল */}
              <div className="flex-1 flex flex-col">
                {!selectedStaffId ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                    কথোপকথন শুরু করতে বাম পাশ থেকে একজন স্টাফ নির্বাচন করুন
                  </div>
                ) : (
                  <>
                    <div className="px-6 py-4 border-b border-gray-200">
                      <p className="font-bold">
                        {staffList.find((s) => s.id === selectedStaffId)?.full_name || 'নামহীন স্টাফ'}
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-gray-50">
                      {messagesLoading ? (
                        <p className="text-center text-sm text-gray-400">লোড করছি...</p>
                      ) : (
                        messages
                          .filter(
                            (m) =>
                              (m.sender_id === user.id && m.receiver_id === selectedStaffId) ||
                              (m.sender_id === selectedStaffId && m.receiver_id === user.id)
                          )
                          .map((m) => (
                            <div
                              key={m.id}
                              className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                                  m.sender_id === user.id
                                    ? 'bg-indigo-600 text-white rounded-br-sm'
                                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                <p
                                  className={`text-[10px] mt-1 ${
                                    m.sender_id === user.id ? 'text-indigo-200' : 'text-gray-400'
                                  }`}
                                >
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
                        placeholder="মেসেজ লিখুন..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!messageText.trim() || sendingMessage}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {editingProfile && (
        <StaffProfileEditModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onUpdated={() => {
            fetchProfiles()
            fetchPerformance()
          }}
        />
      )}

      {showCouponModal && (
        <CouponFormModal
          coupon={editingCoupon}
          services={services}
          onClose={() => {
            setShowCouponModal(false)
            setEditingCoupon(null)
          }}
          onSaved={fetchCoupons}
        />
      )}

      {showServiceModal && (
        <ServiceFormModal
          service={editingService}
          onClose={() => {
            setShowServiceModal(false)
            setEditingService(null)
          }}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}

function StaffProfileEditModal({
  profile,
  onClose,
  onUpdated,
}: {
  profile: Profile
  onClose: () => void
  onUpdated: () => void
}) {
  const [specialization, setSpecialization] = useState(
    (profile.specialization || []).join(', ')
  )
  const [maxOrders, setMaxOrders] = useState(profile.max_concurrent_orders ?? 10)
  const [isAvailable, setIsAvailable] = useState(profile.is_available ?? true)
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>(
    profile.commission_type || 'percentage'
  )
  const [commissionRate, setCommissionRate] = useState(profile.commission_rate ?? 0)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const specArray = specialization
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      const { error } = await supabase
        .from('profiles')
        .update({
          specialization: specArray,
          max_concurrent_orders: maxOrders,
          is_available: isAvailable,
          commission_type: commissionType,
          commission_rate: commissionRate,
        })
        .eq('id', profile.id)

      if (error) throw error

      onUpdated()
      onClose()
    } catch (error) {
      console.error('প্রোফাইল আপডেট ত্রুটি:', error)
      alert('আপডেট করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">
            {profile.full_name || 'স্টাফ'} — প্রোফাইল এডিট
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">
            স্পেশালাইজেশন (কমা দিয়ে আলাদা করুন, ক্যাটাগরি অনুযায়ী)
          </label>
          <input
            type="text"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="যেমন: ভিসা, আইটি"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            services টেবিলের category কলামের মান অনুযায়ী লিখুন। খালি রাখলে এই স্টাফ সব ধরনের কাজের জন্য বিবেচিত হবে।
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">
            সর্বোচ্চ একসাথে কতগুলো অর্ডার নিতে পারবে
          </label>
          <input
            type="number"
            min={1}
            value={maxOrders}
            onChange={(e) => setMaxOrders(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">কমিশন</label>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={commissionType}
              onChange={(e) => setCommissionType(e.target.value as 'percentage' | 'fixed')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="percentage">শতাংশ (%)</option>
              <option value="fixed">প্রতি অর্ডার নির্দিষ্ট (৳)</option>
            </select>
            <input
              type="number"
              min={0}
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            অর্ডার সম্পন্ন (completed) হলে এই হার অনুযায়ী কমিশন হিসাব হবে
          </p>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-semibold">এই স্টাফ এখন কাজ নিতে পারবে (Available)</span>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 py-2 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            বাতিল
          </button>
        </div>
      </div>
    </div>
  )
}

function CouponFormModal({
  coupon,
  services,
  onClose,
  onSaved,
}: {
  coupon: Coupon | null
  services: Service[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!coupon
  const categories = Array.from(new Set(services.map((s) => s.category).filter(Boolean)))

  const [code, setCode] = useState(coupon?.code || '')
  const [description, setDescription] = useState(coupon?.description || '')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
    coupon?.discount_type || 'percentage'
  )
  const [discountValue, setDiscountValue] = useState(coupon?.discount_value ?? 10)
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(
    coupon?.max_discount_amount != null ? String(coupon.max_discount_amount) : ''
  )
  const [minOrderAmount, setMinOrderAmount] = useState(coupon?.min_order_amount ?? 0)
  const [usageLimit, setUsageLimit] = useState(
    coupon?.usage_limit != null ? String(coupon.usage_limit) : ''
  )
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState(
    coupon?.usage_limit_per_customer ?? 1
  )
  const [applicableCategories, setApplicableCategories] = useState<string[]>(
    coupon?.applicable_categories || []
  )
  const [validUntil, setValidUntil] = useState(
    coupon?.valid_until ? coupon.valid_until.slice(0, 10) : ''
  )
  const [isActive, setIsActive] = useState(coupon?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleCategory = (cat: string) => {
    setApplicableCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleSave = async () => {
    setError('')
    if (!code.trim()) {
      setError('কুপন কোড আবশ্যক')
      return
    }
    if (discountValue <= 0) {
      setError('ছাড়ের পরিমাণ ০ এর বেশি হতে হবে')
      return
    }

    setSaving(true)
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        discount_type: discountType,
        discount_value: discountValue,
        max_discount_amount:
          discountType === 'percentage' && maxDiscountAmount ? Number(maxDiscountAmount) : null,
        min_order_amount: minOrderAmount,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        usage_limit_per_customer: usageLimitPerCustomer,
        applicable_categories: applicableCategories.length > 0 ? applicableCategories : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        is_active: isActive,
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', coupon!.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('coupons').insert(payload)
        if (insertError) throw insertError
      }

      onSaved()
      onClose()
    } catch (err: any) {
      console.error('কুপন সেভ ত্রুটি:', err)
      if (err?.code === '23505') {
        setError('এই কোডের একটি কুপন ইতিমধ্যে আছে')
      } else {
        setError('সেভ করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full my-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{isEditing ? 'কুপন এডিট করুন' : 'নতুন কুপন তৈরি করুন'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">কুপন কোড</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="যেমন: EID20"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">বিবরণ (ঐচ্ছিক)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="যেমন: ঈদ স্পেশাল ২০% ছাড়"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">ছাড়ের ধরন</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="percentage">শতাংশ (%)</option>
              <option value="fixed">নির্দিষ্ট টাকা (৳)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              ছাড়ের পরিমাণ {discountType === 'percentage' ? '(%)' : '(৳)'}
            </label>
            <input
              type="number"
              min={0}
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {discountType === 'percentage' && (
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-2">সর্বোচ্চ ছাড় (৳, ঐচ্ছিক)</label>
              <input
                type="number"
                min={0}
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                placeholder="সীমাহীন রাখতে খালি রাখুন"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2">সর্বনিম্ন অর্ডার (৳)</label>
            <input
              type="number"
              min={0}
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">মেয়াদ শেষ (ঐচ্ছিক)</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">মোট ব্যবহারের সীমা (ঐচ্ছিক)</label>
            <input
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="সীমাহীন রাখতে খালি রাখুন"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">প্রতি গ্রাহক ব্যবহারের সীমা</label>
            <input
              type="number"
              min={1}
              value={usageLimitPerCustomer}
              onChange={(e) => setUsageLimitPerCustomer(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {categories.length > 0 && (
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-2">
                প্রযোজ্য ক্যাটাগরি (কিছু না বাছলে সব সেবায় প্রযোজ্য হবে)
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${
                      applicableCategories.includes(cat)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-semibold">কুপনটি সক্রিয় রাখুন</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 py-2 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            বাতিল
          </button>
        </div>
      </div>
    </div>
  )
}

function ServiceFormModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!service
  const [name, setName] = useState(service?.name || '')
  const [description, setDescription] = useState(service?.description || '')
  const [price, setPrice] = useState(service?.price ?? 0)
  const [category, setCategory] = useState(service?.category || '')
  const [isActive, setIsActive] = useState(service?.is_active ?? true)

  // জরুরি (urgent) ফি সংক্রান্ত স্টেট
  const [urgentEnabled, setUrgentEnabled] = useState(!!service?.urgent_fee_type)
  const [urgentFeeType, setUrgentFeeType] = useState<'fixed' | 'percentage'>(
    service?.urgent_fee_type === 'percentage' ? 'percentage' : 'fixed'
  )
  const [urgentFeeValue, setUrgentFeeValue] = useState(service?.urgent_fee_value ?? 0)
  const [urgentDeliveryHours, setUrgentDeliveryHours] = useState(service?.urgent_delivery_hours ?? 24)

  // কাস্টম রিকোয়ারমেন্ট ফিল্ড সংক্রান্ত স্টেট
  const [customFields, setCustomFields] = useState
    { id?: string; field_label: string; field_type: string; options: string; is_required: boolean }[]
  >([])
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEditing && service) {
      fetchExistingCustomFields(service.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchExistingCustomFields = async (serviceId: string) => {
    setCustomFieldsLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('service_custom_fields')
        .select('*')
        .eq('service_id', serviceId)
        .order('display_order', { ascending: true })

      if (fetchError) throw fetchError

      setCustomFields(
        (data || []).map((f: any) => ({
          id: f.id,
          field_label: f.field_label,
          field_type: f.field_type,
          options: (f.options || []).join(', '),
          is_required: f.is_required,
        }))
      )
    } catch (err) {
      console.error('কাস্টম ফিল্ড লোড ত্রুটি:', err)
    } finally {
      setCustomFieldsLoading(false)
    }
  }

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      { field_label: '', field_type: 'text', options: '', is_required: false },
    ])
  }

  const updateCustomField = (index: number, patch: Partial<(typeof customFields)[number]>) => {
    setCustomFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setError('')
    if (!name.trim()) {
      setError('সার্ভিসের নাম আবশ্যক')
      return
    }
    if (!category.trim()) {
      setError('ক্যাটাগরি আবশ্যক')
      return
    }
    if (price < 0) {
      setError('দাম ০ বা তার বেশি হতে হবে')
      return
    }
    if (urgentEnabled && urgentFeeValue <= 0) {
      setError('জরুরি ফি ০ এর বেশি হতে হবে')
      return
    }
    for (const field of customFields) {
      if (!field.field_label.trim()) {
        setError('প্রতিটি কাস্টম ফিল্ডের লেবেল আবশ্যক')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price,
        category: category.trim(),
        is_active: isActive,
        urgent_fee_type: urgentEnabled ? urgentFeeType : null,
        urgent_fee_value: urgentEnabled ? urgentFeeValue : null,
        urgent_delivery_hours: urgentEnabled ? urgentDeliveryHours : null,
      }

      let serviceId = service?.id

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('services')
          .update(payload)
          .eq('id', service!.id)
        if (updateError) throw updateError
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('services')
          .insert(payload)
          .select('id')
          .single()
        if (insertError) throw insertError
        serviceId = inserted.id
      }

      // কাস্টম ফিল্ড সিঙ্ক করুন: পুরনো সব মুছে নতুন করে ইনসার্ট করা সবচেয়ে সহজ ও নিরাপদ পদ্ধতি
      if (serviceId) {
        const { error: deleteError } = await supabase
          .from('service_custom_fields')
          .delete()
          .eq('service_id', serviceId)
        if (deleteError) throw deleteError

        if (customFields.length > 0) {
          const fieldsPayload = customFields.map((f, index) => ({
            service_id: serviceId,
            field_label: f.field_label.trim(),
            field_type: f.field_type,
            options:
              f.field_type === 'select'
                ? f.options.split(',').map((o) => o.trim()).filter(Boolean)
                : null,
            is_required: f.is_required,
            display_order: index,
          }))

          const { error: fieldsInsertError } = await supabase
            .from('service_custom_fields')
            .insert(fieldsPayload)
          if (fieldsInsertError) throw fieldsInsertError
        }
      }

      onSaved()
      onClose()
    } catch (err: any) {
      console.error('সার্ভিস সেভ ত্রুটি:', err)
      setError('সার্ভিস সেভ করতে সমস্যা হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full my-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{isEditing ? 'সার্ভিস এডিট করুন' : 'নতুন সার্ভিস তৈরি করুন'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">সার্ভিসের নাম</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: পাসপোর্ট রিনিউ"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">বিবরণ (ঐচ্ছিক)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="সংক্ষিপ্ত বিবরণ"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">ক্যাটাগরি</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="যেমন: E-Services & Online Work"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">দাম (৳)</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-semibold">সার্ভিসটি সক্রিয় রাখুন (গ্রাহক দেখতে পাবে)</span>
            </label>
          </div>
        </div>

        {/* জরুরি (Urgent) ফি সেকশন — ডায়নামিক প্রাইসিং */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={urgentEnabled}
              onChange={(e) => setUrgentEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-semibold">জরুরি (Urgent) ডেলিভারি অপশন চালু করুন</span>
          </label>

          {urgentEnabled && (
            <div className="grid grid-cols-2 gap-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div>
                <label className="block text-sm font-semibold mb-2">ফি এর ধরন</label>
                <select
                  value={urgentFeeType}
                  onChange={(e) => setUrgentFeeType(e.target.value as 'fixed' | 'percentage')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="fixed">নির্দিষ্ট টাকা (৳)</option>
                  <option value="percentage">শতকরা (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  ফি এর পরিমাণ {urgentFeeType === 'percentage' ? '(%)' : '(৳)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={urgentFeeValue}
                  onChange={(e) => setUrgentFeeValue(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-2">ডেলিভারির সময়সীমা (ঘণ্টা)</label>
                <input
                  type="number"
                  min={1}
                  value={urgentDeliveryHours}
                  onChange={(e) => setUrgentDeliveryHours(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-orange-600 mt-1">
                  গ্রাহক "জরুরি" বেছে নিলে এই সময়ের মধ্যে ডেলিভারি ডেডলাইন সেট হবে
                </p>
              </div>
            </div>
          )}
        </div>

        {/* কাস্টম রিকোয়ারমেন্ট বিল্ডার */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">কাস্টম রিকোয়ারমেন্ট ফিল্ড</span>
            <button
              type="button"
              onClick={addCustomField}
              className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition font-semibold"
            >
              <Plus className="w-4 h-4" /> ফিল্ড যোগ করুন
            </button>
          </div>

          {customFieldsLoading ? (
            <p className="text-sm text-gray-400">লোড হচ্ছে...</p>
          ) : customFields.length === 0 ? (
            <p className="text-sm text-gray-400">
              এই সার্ভিসের জন্য কোনো অতিরিক্ত তথ্য ফিল্ড নেই। অর্ডার ফর্মে গ্রাহকের কাছ থেকে বাড়তি তথ্য নিতে চাইলে ফিল্ড যোগ করুন।
            </p>
          ) : (
            <div className="space-y-3">
              {customFields.map((field, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={field.field_label}
                      onChange={(e) => updateCustomField(index, { field_label: e.target.value })}
                      placeholder="ফিল্ডের নাম (যেমন: বাবার নাম)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <select
                      value={field.field_type}
                      onChange={(e) => updateCustomField(index, { field_type: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="text">ছোট টেক্সট</option>
                      <option value="textarea">বড় টেক্সট</option>
                      <option value="number">সংখ্যা</option>
                      <option value="select">ড্রপডাউন</option>
                      <option value="checkbox">চেকবক্স</option>
                    </select>
                    <label className="flex items-center gap-1 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.is_required}
                        onChange={(e) => updateCustomField(index, { is_required: e.target.checked })}
                        className="w-4 h-4"
                      />
                      আবশ্যক
                    </label>
                  </div>
                  {field.field_type === 'select' && (
                    <input
                      type="text"
                      value={field.options}
                      onChange={(e) => updateCustomField(index, { options: e.target.value })}
                      placeholder="অপশনগুলো কমা দিয়ে লিখুন (যেমন: পুরুষ, মহিলা)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 py-2 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            বাতিল
          </button>
        </div>
      </div>
    </div>
  )
}
}
