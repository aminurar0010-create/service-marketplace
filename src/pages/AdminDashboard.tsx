import { useEffect, useState } from 'react'
import { supabase, Order, Service, Profile, Coupon, StaffPerformance, Message, GalleryPhoto } from '../lib/supabase'
import { Package, Layers, Users, Ticket, Award, MessageSquare, Images } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import OrdersTab from '../admin/OrdersTab'
import ServicesTab from '../admin/ServicesTab'
import StaffTab from '../admin/StaffTab'
import CouponsTab from '../admin/CouponsTab'
import PerformanceTab from '../admin/PerformanceTab'
import MessagesTab from '../admin/MessagesTab'
import GalleryTab from '../admin/GalleryTab'
import StaffProfileEditModal from '../admin/StaffProfileEditModal'
import CouponFormModal from '../admin/CouponFormModal'
import ServiceFormModal from '../admin/ServiceFormModal'
import GalleryFormModal from '../admin/GalleryFormModal'

export default function AdminDashboard({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'services' | 'staff' | 'coupons' | 'performance' | 'messages' | 'gallery'>('orders')

  const [orders, setOrders] = useState<Order[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffList, setStaffList] = useState<Profile[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [performance, setPerformance] = useState<StaffPerformance[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [showGalleryModal, setShowGalleryModal] = useState(false)
  const [editingGalleryPhoto, setEditingGalleryPhoto] = useState<GalleryPhoto | null>(null)
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
    if (activeTab === 'gallery') {
      fetchGalleryPhotos()
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

  const fetchGalleryPhotos = async () => {
    setGalleryLoading(true)
    try {
      const { data, error } = await supabase
        .from('gallery_photos')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) throw error
      setGalleryPhotos(data || [])
    } catch (error) {
      console.error('গ্যালারি লোড ত্রুটি:', error)
    } finally {
      setGalleryLoading(false)
    }
  }

  const toggleGalleryPhotoActive = async (photo: GalleryPhoto) => {
    try {
      const { error } = await supabase
        .from('gallery_photos')
        .update({ is_active: !photo.is_active })
        .eq('id', photo.id)

      if (error) throw error
      fetchGalleryPhotos()
    } catch (error) {
      console.error('গ্যালারি ছবি স্ট্যাটাস আপডেট ত্রুটি:', error)
      alert('ছবির স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে')
    }
  }

  const deleteGalleryPhoto = async (photo: GalleryPhoto) => {
    const confirmed = window.confirm('এই ছবিটি স্থায়ীভাবে মুছে ফেলতে চান?')
    if (!confirmed) return

    try {
      const { error } = await supabase.from('gallery_photos').delete().eq('id', photo.id)
      if (error) throw error
      fetchGalleryPhotos()
    } catch (error) {
      console.error('গ্যালারি ছবি ডিলিট ত্রুটি:', error)
      alert('ছবি মুছতে সমস্যা হয়েছে')
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


  const ctx = {
    activeTab, setActiveTab, orders, setOrders,
    services, setServices, staffList, setStaffList,
    profiles, setProfiles, coupons, setCoupons,
    performance, setPerformance, messages, setMessages,
    selectedStaffId, setSelectedStaffId, messageText, setMessageText,
    loading, setLoading, staffLoading, couponsLoading,
    performanceLoading, messagesLoading, sendingMessage, selectedOrderIds,
    setSelectedOrderIds, bulkStaffId, setBulkStaffId, bulkStatus,
    setBulkStatus, bulkProcessing, editingProfile, setEditingProfile,
    showCouponModal, setShowCouponModal, editingCoupon, setEditingCoupon,
    showServiceModal, setShowServiceModal, editingService, setEditingService,
    assigningOrderId, setAssigningOrderId, stats, user,
    fetchData, fetchProfiles, fetchMessages, getUnreadCount,
    totalUnreadMessages, selectStaffConversation, sendMessage, fetchPerformance,
    getDeadlineInfo, fetchCoupons, toggleCouponActive, deleteCoupon,
    toggleServiceActive, deleteService, isCouponExpired, updateOrderStatus,
    assignStaff, autoAssignStaff, toggleSelectOrder, toggleSelectAllOrders,
    clearSelection, bulkAssignStaff, bulkUpdateStatus, exportSelectedCSV,
    toggleRole, getServiceName, getStatusColor, getStatusLabel,
    galleryPhotos, setGalleryPhotos, galleryLoading, showGalleryModal,
    setShowGalleryModal, editingGalleryPhoto, setEditingGalleryPhoto,
    fetchGalleryPhotos, toggleGalleryPhotoActive, deleteGalleryPhoto,
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
          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'gallery'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Images size={18} />
            গ্যালারি ম্যানেজমেন্ট
          </button>
        </div>

        {activeTab === 'orders' && <OrdersTab ctx={ctx} />}
        {activeTab === 'services' && <ServicesTab ctx={ctx} />}
        {activeTab === 'staff' && <StaffTab ctx={ctx} />}
        {activeTab === 'coupons' && <CouponsTab ctx={ctx} />}
        {activeTab === 'performance' && <PerformanceTab ctx={ctx} />}
        {activeTab === 'messages' && <MessagesTab ctx={ctx} />}
        {activeTab === 'gallery' && <GalleryTab ctx={ctx} />}
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

      {showGalleryModal && (
        <GalleryFormModal
          photo={editingGalleryPhoto}
          onClose={() => {
            setShowGalleryModal(false)
            setEditingGalleryPhoto(null)
          }}
          onSaved={fetchGalleryPhotos}
        />
      )}
    </div>
  )
}
