import { useEffect, useState } from 'react'
import { supabase, Order, Service, Profile, Coupon, StaffPerformance, Message, GalleryPhoto, logActivity } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { 
  Package, Layers, Users, Ticket, Award, MessageSquare, Image as GalleryIcon, Star, 
  Wallet, PieChart, Settings as SettingsIcon, Boxes, ShoppingCart, Menu, X, TrendingUp,
  DollarSign, Clock
} from 'lucide-react'
import OrdersTab from '../admin/OrdersTab'
import ServicesTab from '../admin/ServicesTab'
import StaffTab from '../admin/StaffTab'
import CouponsTab from '../admin/CouponsTab'
import PerformanceTab from '../admin/PerformanceTab'
import MessagesTab from '../admin/MessagesTab'
import GalleryTab from '../admin/GalleryTab'
import ReviewsTab from '../admin/ReviewsTab'
import CashBookTab from '../admin/CashBookTab'
import ReportsTab from '../admin/ReportsTab'
import SettingsTab from '../admin/SettingsTab'
import InventoryTab from '../admin/InventoryTab'
import POSTab from '../admin/POSTab'
import StaffProfileEditModal from '../admin/StaffProfileEditModal'
import CouponFormModal from '../admin/CouponFormModal'
import ServiceFormModal from '../admin/ServiceFormModal'
import GalleryFormModal from '../admin/GalleryFormModal'

type Tab = 'orders' | 'services' | 'staff' | 'coupons' | 'performance' | 'messages' | 'gallery' | 'reviews' | 'cashbook' | 'reports' | 'settings' | 'inventory' | 'pos'

interface NavItem {
  id: Tab
  label: string
  icon: any
  badge?: number
}

interface StatCard {
  label: string
  value: string | number
  icon: any
  trend?: number
  bgGradient: string
  textColor: string
}

export default function AdminDashboardV2({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<Tab>('orders')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [, setMobileMenuOpen] = useState(false)

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
    if (activeTab === 'staff') fetchProfiles()
    if (activeTab === 'coupons') fetchCoupons()
    if (activeTab === 'performance') fetchPerformance()
    if (activeTab === 'gallery') fetchGalleryPhotos()
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

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
      logActivity('অর্ডার স্ট্যাটাস পরিবর্তন করেছেন', 'order', orderId, { status: newStatus })
      fetchData()
    } catch (error) {
      console.error('অর্ডার আপডেট ত্রুটি:', error)
    }
  }

  const updateOrderPaymentStatus = async (orderId: string, newStatus: string) => {
    try {
      await supabase.from('orders').update({ payment_status: newStatus }).eq('id', orderId)
      logActivity('পেমেন্ট স্ট্যাটাস পরিবর্তন করেছেন', 'order', orderId, { payment_status: newStatus })
      fetchData()
    } catch (error) {
      console.error('পেমেন্ট আপডেট ত্রুটি:', error)
    }
  }

  const assignStaff = async (orderId: string, staffId: string) => {
    try {
      await supabase
        .from('orders')
        .update({ assigned_staff_id: staffId || null })
        .eq('id', orderId)
      logActivity('স্টাফ অ্যাসাইন করেছেন', 'order', orderId, { assigned_staff_id: staffId })
      fetchData()
    } catch (error) {
      console.error('স্টাফ অ্যাসাইন ত্রুটি:', error)
    }
  }

  const autoAssignStaff = async (orderId: string) => {
    setAssigningOrderId(orderId)
    try {
      const availableStaff = staffList.filter((s) => s.is_available)
      const pool = availableStaff.length > 0 ? availableStaff : staffList
      if (pool.length === 0) return

      const workload: Record<string, number> = {}
      pool.forEach((s) => (workload[s.id] = 0))
      orders.forEach((o) => {
        if (
          o.assigned_staff_id &&
          workload[o.assigned_staff_id] !== undefined &&
          o.status !== 'completed' &&
          o.status !== 'cancelled'
        ) {
          workload[o.assigned_staff_id]++
        }
      })

      const chosen = pool.reduce((best, s) =>
        workload[s.id] < workload[best.id] ? s : best
      , pool[0])

      await assignStaff(orderId, chosen.id)
    } catch (error) {
      console.error('অটো-অ্যাসাইন ত্রুটি:', error)
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
    setSelectedOrderIds((prev) => (prev.length === orders.length ? [] : orders.map((o) => o.id)))
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
      await supabase.from('orders').update({ assigned_staff_id: bulkStaffId }).in('id', selectedOrderIds)
      logActivity('বাল্ক স্টাফ অ্যাসাইন করেছেন', 'order', selectedOrderIds.join(','), { assigned_staff_id: bulkStaffId })
      clearSelection()
      fetchData()
    } catch (error) {
      console.error('বাল্ক অ্যাসাইন ত্রুটি:', error)
    } finally {
      setBulkProcessing(false)
    }
  }

  const bulkUpdateStatus = async () => {
    if (!bulkStatus || selectedOrderIds.length === 0) return
    setBulkProcessing(true)
    try {
      await supabase.from('orders').update({ status: bulkStatus }).in('id', selectedOrderIds)
      logActivity('বাল্ক স্ট্যাটাস পরিবর্তন করেছেন', 'order', selectedOrderIds.join(','), { status: bulkStatus })
      clearSelection()
      fetchData()
    } catch (error) {
      console.error('বাল্ক স্ট্যাটাস আপডেট ত্রুটি:', error)
    } finally {
      setBulkProcessing(false)
    }
  }

  const exportSelectedCSV = () => {
    const selected = orders.filter((o) => selectedOrderIds.includes(o.id))
    if (selected.length === 0) return

    const headers = ['ট্র্যাকিং ID', 'গ্রাহক', 'ফোন', 'সেবা', 'পরিমাণ', 'পেমেন্ট', 'অবস্থা', 'সময়']
    const rows = selected.map((o) => [
      o.tracking_id,
      o.customer_name,
      o.customer_phone,
      getServiceName(o.service_id),
      o.total_amount,
      o.payment_status,
      getStatusLabel(o.status),
      new Date(o.created_at).toLocaleString('bn-BD'),
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getUnreadCount = (staffId: string) =>
    messages.filter((m) => m.sender_id === staffId && m.receiver_id === user.id && !m.is_read).length

  const totalUnreadMessages = staffList.reduce((sum, s) => sum + getUnreadCount(s.id), 0)

  const ctx = {
    orders, setOrders, services, setServices, staffList, setStaffList, profiles, setProfiles,
    coupons, setCoupons, performance, setPerformance, messages, setMessages, loading, setLoading,
    showGalleryModal, setShowGalleryModal, editingGalleryPhoto, setEditingGalleryPhoto,
    galleryPhotos, setGalleryPhotos, galleryLoading, setGalleryLoading, activeTab, user,
    editingProfile, setEditingProfile, showCouponModal, setShowCouponModal, editingCoupon,
    setEditingCoupon, showServiceModal, setShowServiceModal, editingService, setEditingService,
    selectedOrderIds, setSelectedOrderIds, bulkStaffId, setBulkStaffId, bulkStatus, setBulkStatus,
    bulkProcessing, setBulkProcessing, staffLoading, setStaffLoading, couponsLoading,
    setCouponsLoading, performanceLoading, setPerformanceLoading, messagesLoading,
    setMessagesLoading, sendingMessage, setSendingMessage, selectedStaffId, setSelectedStaffId,
    messageText, setMessageText, logActivity, stats, assigningOrderId,
    getServiceName, getStatusColor, getStatusLabel, getDeadlineInfo,
    updateOrderStatus, updateOrderPaymentStatus, assignStaff, autoAssignStaff,
    toggleSelectOrder, toggleSelectAllOrders, clearSelection,
    bulkAssignStaff, bulkUpdateStatus, exportSelectedCSV,
  }

  const navItems: NavItem[] = [
    { id: 'orders', label: 'অর্ডার ও পরিসংখ্যান', icon: Package },
    { id: 'services', label: 'সার্ভিস ম্যানেজমেন্ট', icon: Layers },
    { id: 'staff', label: 'স্টাফ ম্যানেজমেন্ট', icon: Users },
    { id: 'coupons', label: 'কুপন ম্যানেজমেন্ট', icon: Ticket },
    { id: 'performance', label: 'পারফরম্যান্স', icon: Award },
    { id: 'messages', label: 'মেসেজ', icon: MessageSquare, badge: totalUnreadMessages },
    { id: 'gallery', label: 'গ্যালারি', icon: GalleryIcon },
    { id: 'reviews', label: 'রিভিউ', icon: Star },
    { id: 'cashbook', label: 'ক্যাশ-বুক', icon: Wallet },
    { id: 'reports', label: 'রিপোর্টস', icon: PieChart },
    { id: 'inventory', label: 'ইনভেন্টরি', icon: Boxes },
    { id: 'pos', label: 'POS', icon: ShoppingCart },
    { id: 'settings', label: 'সেটিংস', icon: SettingsIcon },
  ]

  const statCards: StatCard[] = [
    {
      label: 'মোট অর্ডার',
      value: stats.totalOrders,
      icon: Package,
      trend: 12,
      bgGradient: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-600',
    },
    {
      label: 'আজকের অর্ডার',
      value: stats.todayOrders,
      icon: Clock,
      trend: 8,
      bgGradient: 'from-emerald-500 to-emerald-600',
      textColor: 'text-emerald-600',
    },
    {
      label: 'মোট রাজস্ব',
      value: `৳${(stats.totalRevenue || 0).toLocaleString('bn-BD')}`,
      icon: DollarSign,
      trend: 15,
      bgGradient: 'from-purple-500 to-purple-600',
      textColor: 'text-purple-600',
    },
    {
      label: 'আজকের রাজস্ব',
      value: `৳${(stats.todayRevenue || 0).toLocaleString('bn-BD')}`,
      icon: TrendingUp,
      trend: 5,
      bgGradient: 'from-pink-500 to-pink-600',
      textColor: 'text-pink-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* শীর্ষ নেভিগেশন বার */}
      <header className="fixed top-0 right-0 left-0 md:left-64 h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-40 shadow-sm">
        <div className="flex items-center justify-between h-full px-4 md:px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <div className="flex-1"></div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">অ্যাডমিন</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500"></div>
          </div>
        </div>
      </header>

      {/* সাইডবার */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 overflow-y-auto transition-all duration-300 z-30 ${
          !sidebarOpen ? '-translate-x-full md:translate-x-0' : ''
        }`}
      >
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  setMobileMenuOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={20} className={activeTab === item.id ? '' : 'group-hover:scale-110 transition'} />
                <span className="flex-1 text-left font-medium text-sm">{item.label}</span>
                {item.badge ? (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* মূল কন্টেন্ট */}
      <main className="pt-20 md:pt-20 md:ml-64">
        <div className="p-4 md:p-8 max-w-7xl">
          {/* স্ট্যাটস কার্ড */}
          {activeTab === 'orders' && (
            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((stat, i) => {
                const Icon = stat.icon
                return (
                  <div
                    key={i}
                    className={`group bg-gradient-to-br ${stat.bgGradient} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden relative`}
                  >
                    {/* ব্যাকগ্রাউন্ড ডেকোরেশন */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <Icon size={32} className="opacity-80" />
                        {stat.trend && (
                          <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full text-sm">
                            <TrendingUp size={14} />
                            <span>+{stat.trend}%</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium opacity-90 mb-2">{stat.label}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ট্যাব কন্টেন্ট */}
          {activeTab === 'orders' && <OrdersTab ctx={ctx} />}
          {activeTab === 'services' && <ServicesTab ctx={ctx} />}
          {activeTab === 'staff' && <StaffTab ctx={ctx} />}
          {activeTab === 'coupons' && <CouponsTab ctx={ctx} />}
          {activeTab === 'performance' && <PerformanceTab ctx={ctx} />}
          {activeTab === 'messages' && <MessagesTab ctx={ctx} />}
          {activeTab === 'gallery' && <GalleryTab ctx={ctx} />}
          {activeTab === 'reviews' && <ReviewsTab />}
          {activeTab === 'cashbook' && <CashBookTab />}
          {activeTab === 'reports' && <ReportsTab services={services} orders={orders} />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'inventory' && <InventoryTab />}
          {activeTab === 'pos' && <POSTab />}
        </div>
      </main>

      {/* মডালগুলো */}
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
