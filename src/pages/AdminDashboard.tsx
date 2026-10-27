import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, ShopCustomerSummary, Order, Service, Profile, Coupon, StaffPerformance, Message, GalleryPhoto, logActivity } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { 
  Package, Layers, Users, Ticket, Award, MessageSquare, Image as GalleryIcon, Star, 
  Wallet, PieChart, Settings as SettingsIcon, Boxes, ShoppingCart, MoreVertical, TrendingUp,
  DollarSign, Clock, Globe, Newspaper, Sparkles, UserCog, Briefcase, BookUser, GraduationCap, Banknote, ClipboardCheck, ShieldCheck, Calculator, Plane, Camera,
  ChevronDown, ChevronRight, Zap, Menu as MenuIcon
} from 'lucide-react'
import GlobalSearch from '../admin/GlobalSearch'
import { canViewTab } from '../lib/permissions'

// ট্যাব ও মডাল দরকার হলেই লোড হয়
const OrdersTab = lazy(() => import('../admin/OrdersTab'))
const TodayDashboard = lazy(() => import('../admin/TodayDashboard'))
const MessageTemplatesTab = lazy(() => import('../admin/MessageTemplatesTab'))
const ServicesTab = lazy(() => import('../admin/ServicesTab'))
const StaffTab = lazy(() => import('../admin/StaffTab'))
const CouponsTab = lazy(() => import('../admin/CouponsTab'))
const PerformanceTab = lazy(() => import('../admin/PerformanceTab'))
const MessagesTab = lazy(() => import('../admin/MessagesTab'))
const GalleryTab = lazy(() => import('../admin/GalleryTab'))
const ReviewsTab = lazy(() => import('../admin/ReviewsTab'))
const CashBookTab = lazy(() => import('../admin/CashBookTab'))
const DueCollectionTab = lazy(() => import('../admin/DueCollectionTab'))
const TrainingTab = lazy(() => import('../admin/training/TrainingTab'))
const ActivityTab = lazy(() => import('../admin/ActivityTab'))
const QuotesTab = lazy(() => import('../admin/pricing/QuotesTab'))
const TicketsTab = lazy(() => import('../admin/tickets/TicketsTab'))
const PhotoTab = lazy(() => import('../admin/photo/PhotoTab'))
const CustomerProfileModal = lazy(() => import('../admin/CustomerProfileModal'))
const OrderDetailModal = lazy(() => import('../admin/OrderDetailModal'))
const ReportsTab = lazy(() => import('../admin/ReportsTab'))
const SettingsTab = lazy(() => import('../admin/SettingsTab'))
const InventoryTab = lazy(() => import('../admin/InventoryTab'))
const POSTab = lazy(() => import('../admin/POSTab'))
const StaffProfileEditModal = lazy(() => import('../admin/StaffProfileEditModal'))
const CouponFormModal = lazy(() => import('../admin/CouponFormModal'))
const ServiceFormModal = lazy(() => import('../admin/ServiceFormModal'))
const GalleryFormModal = lazy(() => import('../admin/GalleryFormModal'))
const UsersTab = lazy(() => import('../admin/UsersTab'))
const WebsiteTab = lazy(() => import('../admin/WebsiteTab'))
const BlogTab = lazy(() => import('../admin/BlogTab'))
const AIPromptsTab = lazy(() => import('../admin/AIPromptsTab'))
const PortfolioTab = lazy(() => import('../admin/PortfolioTab'))
const CustomerLedgerTab = lazy(() => import('../admin/CustomerLedgerTab'))
const LeadsTab = lazy(() => import('../admin/LeadsTab'))
const CoursesTab = lazy(() => import('../admin/CoursesTab'))
const EnrollmentsTab = lazy(() => import('../admin/EnrollmentsTab'))
const QuickOrderModal = lazy(() => import('../admin/QuickOrderModal'))
import PageLoader from '../components/PageLoader'

type Tab = 'today' | 'orders' | 'services' | 'staff' | 'coupons' | 'performance' | 'messages' | 'gallery' | 'reviews' | 'cashbook' | 'reports' | 'settings' | 'inventory' | 'pos' | 'users' | 'website' | 'blog' | 'prompts' | 'portfolio' | 'customer_ledger' | 'due_collection' | 'leads' | 'templates' | 'courses' | 'enrollments' | 'training' | 'activity' | 'quotes' | 'tickets' | 'photo'

// ── মেনু সাজানো (ফেজ ৩) ──────────────────────────────────────────────
// দৈনিক কাজ সবার উপরে; "সহজ মোড"-এ শুধু এটিই দেখায়, বাকিগুলো "সব মেনু দেখুন"-এ।
type NavGroupId = 'daily' | 'service' | 'reports' | 'people' | 'website' | 'training' | 'system'

const NAV_GROUPS: { id: NavGroupId; label: string; tabs: Tab[] }[] = [
  { id: 'daily', label: 'দৈনিক কাজ', tabs: ['today', 'orders', 'pos', 'due_collection', 'cashbook', 'customer_ledger'] },
  { id: 'service', label: 'সেবা ও দাম', tabs: ['quotes', 'tickets', 'photo', 'services', 'inventory', 'coupons'] },
  { id: 'reports', label: 'হিসাব ও রিপোর্ট', tabs: ['reports', 'performance', 'activity'] },
  { id: 'people', label: 'কাস্টমার ও মেসেজ', tabs: ['messages', 'reviews', 'leads'] },
  { id: 'website', label: 'ওয়েবসাইট', tabs: ['website', 'blog', 'portfolio', 'gallery', 'prompts'] },
  { id: 'training', label: 'ট্রেনিং', tabs: ['courses'] },
  { id: 'system', label: 'সিস্টেম', tabs: ['staff', 'users', 'settings'] },
]

// একই বিষয়ের একাধিক ট্যাব মেনুতে একটি এন্ট্রি; ভেতরে ছোট ট্যাব-বার (ট্যাবের আইডি অপরিবর্তিত)
const TAB_FAMILIES: Record<string, { label: string; tabs: { id: Tab; label: string }[] }> = {
  messages: { label: 'মেসেজ', tabs: [{ id: 'messages', label: 'মেসেজ' }, { id: 'templates', label: 'মেসেজ টেমপ্লেট' }] },
  courses: {
    label: 'ট্রেনিং',
    tabs: [
      { id: 'courses', label: 'কোর্স' },
      { id: 'enrollments', label: 'ভর্তি আবেদন' },
      { id: 'training', label: 'শিক্ষার্থী ও ট্রেনিং' },
    ],
  },
}

// ফোনের নিচের বার: রোল অনুযায়ী ৪টি + "আরও"
const MOBILE_BAR: Record<string, { id: Tab; label: string }[]> = {
  admin: [
    { id: 'today', label: 'আজ' },
    { id: 'orders', label: 'অর্ডার' },
    { id: 'pos', label: 'বিক্রি' },
    { id: 'due_collection', label: 'বাকি' },
  ],
  counter_operator: [
    { id: 'today', label: 'আজ' },
    { id: 'orders', label: 'অর্ডার' },
    { id: 'customer_ledger', label: 'খাতা' },
    { id: 'cashbook', label: 'ক্যাশ' },
  ],
}

const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth < 768

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

export default function AdminDashboardV2({ user, role }: { user: any; role?: string }) {
  const navigate = useNavigate()
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (isMobileViewport()) return false // ফোনে সাইডবার কন্টেন্ট ঢেকে দেয় — শুরুতে বন্ধ
    try {
      const saved = localStorage.getItem('admin_sidebar_open')
      return saved === null ? true : saved === 'true'
    } catch {
      return true
    }
  })
  const [navMode, setNavMode] = useState<'simple' | 'full'>(() => {
    try {
      return localStorage.getItem('admin_nav_mode') === 'full' ? 'full' : 'simple'
    } catch {
      return 'simple'
    }
  })
  // অ্যাডমিনের পূর্ণ মোডে শুরুতে শুধু "দৈনিক কাজ" খোলা; কম ট্যাবের রোলে (কাউন্টার অপারেটর) সব গ্রুপ খোলা
  const [openGroups, setOpenGroups] = useState<Set<NavGroupId>>(
    () => new Set<NavGroupId>(role === 'admin' ? ['daily'] : NAV_GROUPS.map((g) => g.id))
  )
  const [quickOrderOpen, setQuickOrderOpen] = useState(false)

  const changeNavMode = (mode: 'simple' | 'full') => {
    setNavMode(mode)
    try {
      localStorage.setItem('admin_nav_mode', mode)
    } catch {
      // localStorage অনুপলব্ধ হলে নিরবে এড়িয়ে যান
    }
  }

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev
      if (!isMobileViewport()) {
        try {
          localStorage.setItem('admin_sidebar_open', String(next))
        } catch {
          // localStorage অনুপলব্ধ হলে নিরবে এড়িয়ে যান
        }
      }
      return next
    })
  }

  const [orders, setOrders] = useState<Order[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [searchCustomer, setSearchCustomer] = useState<ShopCustomerSummary | null>(null)
  const [searchOrder, setSearchOrder] = useState<any | null>(null)
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
            !['completed', 'cancelled', 'delivered', 'rejected'].includes(o.status) &&
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
      documents_pending: 'bg-orange-100 text-orange-800',
      ready: 'bg-cyan-100 text-cyan-800',
      processing: 'bg-blue-100 text-blue-800',
      waiting: 'bg-purple-100 text-purple-800',
      quality_check: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      delivered: 'bg-emerald-100 text-emerald-800',
      cancelled: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
      on_hold: 'bg-gray-200 text-gray-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'অপেক্ষায়',
      documents_pending: 'ডকুমেন্ট বাকি',
      ready: 'প্রস্তুত',
      processing: 'প্রক্রিয়াধীন',
      waiting: 'অপেক্ষমাণ',
      quality_check: 'কোয়ালিটি চেক',
      completed: 'সম্পন্ন',
      delivered: 'ডেলিভার হয়েছে',
      cancelled: 'বাতিল',
      rejected: 'প্রত্যাখ্যাত',
      on_hold: 'হোল্ডে আছে',
    }
    return labels[status] || status
  }

  const getPriorityColor = (priority?: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-600',
      normal: 'bg-blue-50 text-blue-700',
      important: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    }
    return colors[priority || 'normal'] || colors.normal
  }

  const getPriorityLabel = (priority?: string) => {
    const labels: Record<string, string> = {
      low: 'কম',
      normal: 'সাধারণ',
      important: 'গুরুত্বপূর্ণ',
      urgent: 'জরুরি',
    }
    return labels[priority || 'normal'] || 'সাধারণ'
  }

  const getDeadlineInfo = (order: Order) => {
    const finishedStatuses = ['completed', 'cancelled', 'delivered', 'rejected']
    if (!order.deadline_at || finishedStatuses.includes(order.status)) {
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

      // 'প্রক্রিয়াধীন' স্ট্যাটাসে প্রথমবার গেলে সার্ভিসের সাথে যুক্ত ইনভেন্টরি অটো বিয়োগ করুন (প্রতি অর্ডারে একবারই)
      if (newStatus === 'processing') {
        const order = orders.find((o) => o.id === orderId)
        if (order && !order.inventory_deducted) {
          try {
            const { data: invItems } = await supabase
              .from('service_inventory_items')
              .select('*')
              .eq('service_id', order.service_id)

            if (invItems && invItems.length > 0) {
              for (const item of invItems) {
                await supabase.rpc('adjust_stock', {
                  p_item_id: item.inventory_item_id,
                  p_movement_type: 'out',
                  p_quantity: item.quantity,
                  p_reason: `অর্ডার ${order.tracking_id} এর জন্য স্বয়ংক্রিয় খরচ`,
                })
              }
              await supabase.from('orders').update({ inventory_deducted: true }).eq('id', orderId)
            }
          } catch (invError) {
            console.error('অটো-ইনভেন্টরি বিয়োগ ত্রুটি:', invError)
          }
        }
      }

      fetchData()
    } catch (error) {
      console.error('অর্ডার আপডেট ত্রুটি:', error)
    }
  }

  const updateOrderPriority = async (orderId: string, newPriority: string) => {
    try {
      await supabase.from('orders').update({ priority: newPriority }).eq('id', orderId)
      logActivity('অর্ডার প্রায়োরিটি পরিবর্তন করেছেন', 'order', orderId, { priority: newPriority })
      fetchData()
    } catch (error) {
      console.error('প্রায়োরিটি আপডেট ত্রুটি:', error)
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
          !['completed', 'cancelled', 'delivered', 'rejected'].includes(o.status)
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

  const toggleServiceActive = async (service: Service) => {
    try {
      await supabase.from('services').update({ is_active: !service.is_active }).eq('id', service.id)
      fetchData()
    } catch (error) {
      console.error('সার্ভিস স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const deleteService = async (service: Service) => {
    if (!window.confirm(`"${service.name}" সার্ভিসটি ডিলিট করতে চান?`)) return
    try {
      await supabase.from('services').delete().eq('id', service.id)
      fetchData()
    } catch (error) {
      console.error('সার্ভিস ডিলিট ত্রুটি:', error)
    }
  }

  const setUserRole = async (id: string, newRole: string) => {
    const roleLabel = newRole === 'admin' ? 'অ্যাডমিন' : newRole === 'counter_operator' ? 'কাউন্টার অপারেটর' : 'স্টাফ'
    if (!window.confirm(`এই ইউজারের role "${roleLabel}" করতে চান?`)) return
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', id)
      logActivity('ইউজারের রোল পরিবর্তন করেছেন', 'profile', id, { role: newRole })
      fetchProfiles()
      fetchData()
    } catch (error) {
      console.error('Role পরিবর্তন ত্রুটি:', error)
    }
  }

  const toggleGalleryPhotoActive = async (photo: GalleryPhoto) => {
    try {
      await supabase.from('gallery_photos').update({ is_active: !photo.is_active }).eq('id', photo.id)
      fetchGalleryPhotos()
    } catch (error) {
      console.error('গ্যালারি স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const deleteGalleryPhoto = async (photo: GalleryPhoto) => {
    if (!window.confirm('এই ছবিটি ডিলিট করতে চান?')) return
    try {
      await supabase.from('gallery_photos').delete().eq('id', photo.id)
      fetchGalleryPhotos()
    } catch (error) {
      console.error('গ্যালারি ডিলিট ত্রুটি:', error)
    }
  }

  const toggleCouponActive = async (coupon: Coupon) => {
    try {
      await supabase.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id)
      fetchCoupons()
    } catch (error) {
      console.error('কুপন স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const deleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`কুপন "${coupon.code}" ডিলিট করতে চান?`)) return
    try {
      await supabase.from('coupons').delete().eq('id', coupon.id)
      fetchCoupons()
    } catch (error) {
      console.error('কুপন ডিলিট ত্রুটি:', error)
    }
  }

  const isCouponExpired = (coupon: Coupon) => {
    if (!coupon.valid_until) return false
    return new Date(coupon.valid_until) < new Date()
  }

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
    messageText, setMessageText, logActivity, fetchData, stats, assigningOrderId,
    getServiceName, getStatusColor, getStatusLabel, getDeadlineInfo,
    getPriorityColor, getPriorityLabel,
    updateOrderStatus, updateOrderPriority, updateOrderPaymentStatus, assignStaff, autoAssignStaff,
    toggleSelectOrder, toggleSelectAllOrders, clearSelection,
    bulkAssignStaff, bulkUpdateStatus, exportSelectedCSV,
    toggleServiceActive, deleteService, setUserRole,
    toggleGalleryPhotoActive, deleteGalleryPhoto,
    toggleCouponActive, deleteCoupon, isCouponExpired,
    getUnreadCount, selectStaffConversation, sendMessage,
  }

  const navItems: NavItem[] = [
    { id: 'today', label: 'আজকের কাজ', icon: Sparkles },
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
    { id: 'quotes', label: 'প্রাইস ও কোটেশন', icon: Calculator },
    { id: 'tickets', label: 'টিকিট ডেস্ক', icon: Plane },
    { id: 'photo', label: 'পাসপোর্ট ফটো', icon: Camera },
    { id: 'due_collection', label: 'বাকি আদায়', icon: Banknote },
    { id: 'users', label: 'ইউজার ম্যানেজমেন্ট', icon: UserCog },
    { id: 'customer_ledger', label: 'কাস্টমার খাতা', icon: BookUser },
    { id: 'website', label: 'ওয়েবসাইট ম্যানেজমেন্ট', icon: Globe },
    { id: 'blog', label: 'ব্লগ', icon: Newspaper },
    { id: 'prompts', label: 'AI প্রম্পট লাইব্রেরি', icon: Sparkles },
    { id: 'leads', label: 'লিড ও AI প্রপোজাল', icon: Sparkles },
    { id: 'templates', label: 'মেসেজ টেমপ্লেট', icon: MessageSquare },
    { id: 'portfolio', label: 'আমাদের কাজ', icon: Briefcase },
    { id: 'courses', label: 'Training Courses', icon: GraduationCap },
    { id: 'enrollments', label: 'Student Enrollments', icon: BookUser },
    { id: 'training', label: 'Students & Training', icon: ClipboardCheck },
    { id: 'activity', label: 'লগ ও নিরাপত্তা', icon: ShieldCheck },
    { id: 'settings', label: 'সেটিংস', icon: SettingsIcon },
  ]

  // Permission ম্যাট্রিক্স (src/lib/permissions.ts) অনুযায়ী ট্যাব ফিল্টার
  // মেনুর গ্রুপ/পরিবার — কোন এন্ট্রি এখন সক্রিয়, কোন গ্রুপে
  const navHeadFor = (tab: Tab): Tab => {
    const fam = Object.entries(TAB_FAMILIES).find(([, f]) => f.tabs.some((x) => x.id === tab))
    return (fam ? fam[0] : tab) as Tab
  }
  const activeHead = navHeadFor(activeTab)
  const activeGroupId = NAV_GROUPS.find((g) => g.tabs.includes(activeHead))?.id
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.tabs
      .filter((id) => canViewTab(role, id))
      .map((id) => navItems.find((n) => n.id === id))
      .filter((n): n is NavItem => !!n),
  })).filter((g) => g.items.length > 0)
  const totalNavCount = visibleGroups.reduce((n, g) => n + g.items.length, 0)
  const canSimple = totalNavCount > 8 // কম ট্যাবের রোলে (যেমন কাউন্টার অপারেটর) সহজ মোডের দরকার নেই
  const showFull = navMode === 'full' || !canSimple
  const family = TAB_FAMILIES[activeHead]

  const goTab = (id: Tab) => {
    setActiveTab(id)
    if (isMobileViewport()) setSidebarOpen(false) // ফোনে বেছে নেওয়ার পর মেনু বন্ধ
  }

  const renderNavButton = (item: NavItem) => {
    const Icon = item.icon
    const active = activeHead === item.id
    const label = TAB_FAMILIES[item.id]?.label ?? item.label
    return (
      <button
        key={item.id}
        onClick={() => goTab(item.id)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all group ${
          active
            ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-200'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
        }`}
      >
        <Icon size={20} className={active ? '' : 'group-hover:scale-110 transition'} />
        <span className="flex-1 text-left font-medium text-sm">{label}</span>
        {item.badge ? (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{item.badge}</span>
        ) : null}
      </button>
    )
  }

  // সক্রিয় ট্যাবের গ্রুপটি পূর্ণ মোডে নিজে খুলে থাকে
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => (prev.has(activeGroupId) ? prev : new Set(prev).add(activeGroupId)))
    }
  }, [activeGroupId])

  useEffect(() => {
    if (!canViewTab(role, activeTab)) {
      setActiveTab('today')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, activeTab])

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
      <header
        className={`fixed top-0 right-0 left-0 h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-40 shadow-sm transition-all duration-300 ${
          sidebarOpen ? 'md:left-64' : 'md:left-0'
        }`}
      >
        <div className="flex items-center justify-between h-full px-4 md:px-6">
          <button
            onClick={toggleSidebar}
            title={sidebarOpen ? 'সাইডবার হাইড করুন' : 'সাইডবার দেখান'}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <MoreVertical size={24} />
          </button>
          
          <GlobalSearch
            onOpenCustomer={setSearchCustomer}
            onOpenOrder={async (id) => {
              const { data } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
              if (data) setSearchOrder(data)
            }}
          />
          
          <div className="flex items-center gap-2 md:gap-3">
            {canViewTab(role, 'pos') && (
              <button
                onClick={() => goTab('pos')}
                title="নতুন বিক্রি (POS)"
                className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
              >
                <ShoppingCart size={16} />
                <span className="hidden sm:inline">নতুন বিক্রি</span>
              </button>
            )}
            <button
              onClick={() => setQuickOrderOpen(true)}
              title="কুইক অর্ডার"
              className="flex items-center gap-1.5 bg-amber-500 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-amber-600 transition"
            >
              <Zap size={16} />
              <span className="hidden sm:inline">কুইক অর্ডার</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden lg:block">
              <p className="text-sm font-semibold text-gray-900 dark:text-white max-w-[170px] truncate">{user.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">অ্যাডমিন</p>
            </div>
            <div className="hidden sm:block w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500"></div>
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
      {searchCustomer && (
        <CustomerProfileModal customer={searchCustomer} onClose={() => setSearchCustomer(null)} onChanged={() => setSearchCustomer(null)} />
      )}
      {searchOrder && <OrderDetailModal order={searchOrder} getServiceName={getServiceName} onClose={() => setSearchOrder(null)} />}
      </Suspense>

      {/* ফোনে মেনু খোলা থাকলে বাইরে ট্যাপ করলে বন্ধ */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-black/40 z-20" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* সাইডবার */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 overflow-y-auto transition-all duration-300 z-30 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-4 space-y-1 pb-24 md:pb-4">
          {showFull ? (
            <>
              {canSimple && (
                <button
                  onClick={() => changeNavMode('simple')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 mb-2 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-700 dark:text-indigo-300 transition"
                >
                  ▴ সহজ মোডে ফিরুন
                </button>
              )}
              {visibleGroups.map((g) => {
                const open = openGroups.has(g.id)
                return (
                  <div key={g.id} className="pt-1">
                    <button
                      onClick={() =>
                        setOpenGroups((prev) => {
                          const next = new Set(prev)
                          if (next.has(g.id)) next.delete(g.id)
                          else next.add(g.id)
                          return next
                        })
                      }
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="flex-1 text-left normal-case text-[13px]">{g.label}</span>
                      <span className="text-[11px] font-medium text-gray-400">{g.items.length}</span>
                    </button>
                    {open && <div className="space-y-1">{g.items.map(renderNavButton)}</div>}
                  </div>
                )
              })}
            </>
          ) : (
            <>
              {visibleGroups
                .filter((g) => g.id === 'daily')
                .map((g) => (
                  <div key={g.id} className="space-y-1">
                    {g.items.map(renderNavButton)}
                  </div>
                ))}
              {/* সহজ মোডেও বর্তমানে খোলা ট্যাব যেন হারিয়ে না যায় */}
              {activeGroupId &&
                activeGroupId !== 'daily' &&
                visibleGroups
                  .filter((g) => g.id === activeGroupId)
                  .map((g) => (
                    <div key={g.id} className="pt-2 space-y-1">
                      <p className="px-2 pt-1 text-[13px] font-bold text-gray-500 dark:text-gray-400">{g.label}</p>
                      {g.items.map(renderNavButton)}
                    </div>
                  ))}
              <button
                onClick={() => changeNavMode('full')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 mt-3 rounded-lg text-sm font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-50 dark:text-indigo-300 dark:border-slate-600 dark:hover:bg-slate-700 transition"
              >
                ▾ সব মেনু দেখুন ({totalNavCount})
              </button>
            </>
          )}
          {/* সাইটের নেভবার এখানে নেই — তাই সাইট দেখা ও লগআউট এখানে */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-700 flex gap-2">
            <Link
              to="/"
              className="flex-1 text-center text-xs font-semibold border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg py-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              সাইট দেখুন ↗
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 text-center text-xs font-semibold border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50 transition"
            >
              লগআউট
            </button>
          </div>
        </nav>
      </aside>

      {/* মূল কন্টেন্ট */}
      <main className={`pt-20 md:pt-20 pb-20 md:pb-0 transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-0'}`}>
        <Suspense fallback={<PageLoader />}>
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

          {/* একই বিষয়ের একাধিক ট্যাবের ছোট বার (যেমন ট্রেনিং: কোর্স / ভর্তি আবেদন / শিক্ষার্থী) */}
          {family && (
            <div className="mb-5 flex flex-wrap gap-2">
              {family.tabs
                .filter((x) => canViewTab(role, x.id))
                .map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setActiveTab(x.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                      activeTab === x.id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {x.label}
                  </button>
                ))}
            </div>
          )}

          {/* ট্যাব কন্টেন্ট */}
          {activeTab === 'today' && <TodayDashboard ctx={ctx} canUseAI={role === 'admin'} onGo={role === 'admin' ? (t) => setActiveTab(t as Tab) : undefined} />}
          {activeTab === 'orders' && <OrdersTab ctx={ctx} />}
          {activeTab === 'services' && <ServicesTab ctx={ctx} />}
          {activeTab === 'staff' && <StaffTab ctx={ctx} />}
          {activeTab === 'coupons' && <CouponsTab ctx={ctx} />}
          {activeTab === 'performance' && <PerformanceTab ctx={ctx} />}
          {activeTab === 'messages' && <MessagesTab ctx={ctx} />}
          {activeTab === 'gallery' && <GalleryTab ctx={ctx} />}
          {activeTab === 'reviews' && <ReviewsTab />}
          {activeTab === 'cashbook' && <CashBookTab orders={orders} role={role} />}
          {activeTab === 'reports' && <ReportsTab services={services} orders={orders} />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'inventory' && <InventoryTab />}
          {activeTab === 'pos' && <POSTab />}
          {activeTab === 'tickets' && <TicketsTab role={role} />}
          {activeTab === 'photo' && <PhotoTab role={role} onGo={(t) => setActiveTab(t as Tab)} />}
          {activeTab === 'quotes' && <QuotesTab role={role} onGo={(t) => setActiveTab(t as Tab)} />}
          {activeTab === 'due_collection' && <DueCollectionTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'customer_ledger' && <CustomerLedgerTab />}
          {activeTab === 'website' && <WebsiteTab />}
          {activeTab === 'blog' && <BlogTab />}
          {activeTab === 'prompts' && <AIPromptsTab />}
          {activeTab === 'leads' && <LeadsTab />}
          {activeTab === 'templates' && <MessageTemplatesTab />}
          {activeTab === 'portfolio' && <PortfolioTab />}
          {activeTab === 'courses' && <CoursesTab />}
          {activeTab === 'enrollments' && <EnrollmentsTab />}
          {activeTab === 'training' && <TrainingTab />}
          {activeTab === 'activity' && <ActivityTab />}
        </div>
        </Suspense>
      </main>

      {/* মডালগুলো */}
      <Suspense fallback={null}>
      {quickOrderOpen && <QuickOrderModal ctx={ctx} onClose={() => setQuickOrderOpen(false)} />}
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
      </Suspense>

      {/* ফোনের নিচের বার */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex">
          {(MOBILE_BAR[role ?? ''] || MOBILE_BAR.admin)
            .filter((i) => canViewTab(role, i.id))
            .map((i) => {
              const Icon = navItems.find((n) => n.id === i.id)?.icon || Package
              const active = activeHead === i.id
              return (
                <button
                  key={i.id}
                  onClick={() => goTab(i.id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${
                    active ? 'text-indigo-600' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <Icon size={22} />
                  {i.label}
                </button>
              )
            })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400"
          >
            <MenuIcon size={22} />
            আরও
          </button>
        </div>
      </nav>
    </div>
  )
}
