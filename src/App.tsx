import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, Profile, Customer } from './lib/supabase'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import InstallPrompt from './components/InstallPrompt'
import Analytics from './components/Analytics'
import PageLoader from './components/PageLoader'
import SiteBanner from './components/SiteBanner'
import ScrollToHash from './components/ScrollToHash'
import FloatingContact from './components/FloatingContact'

// Pages
import Home from './pages/Home'

// ভারী পেজগুলো দরকার হলেই লোড হয় (প্রথম লোড হালকা রাখতে)
const OrderForm = lazy(() => import('./pages/OrderForm'))
const TrackingStatus = lazy(() => import('./pages/TrackingStatus'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'))
const CustomerLogin = lazy(() => import('./pages/CustomerLogin'))
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'))
const Blog = lazy(() => import('./pages/Blog'))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'))
const PromptLibrary = lazy(() => import('./pages/PromptLibrary'))
const PortfolioDetailPage = lazy(() => import('./pages/PortfolioDetailPage'))
const ServiceDetailPage = lazy(() => import('./pages/ServiceDetailPage'))
const Courses = lazy(() => import('./pages/Courses'))
const TicketRequest = lazy(() => import('./pages/TicketRequest'))
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'))
const ChatWidget = lazy(() => import('./components/ChatWidget'))

/** অ্যাডমিন ড্যাশবোর্ডে সাইটের ব্যানার/নেভবার/ফুটার দেখানো হয় না — আগে নেভবার অ্যাডমিনের নিজের হেডার (সার্চ, বোতাম) ঢেকে রাখত */
function PublicChrome({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return pathname.startsWith('/admin/dashboard') ? null : <>{children}</>
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null
      setUser(currentUser)

      if (currentUser) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()

        setProfile(profileData || null)

        if (!profileData) {
          const { data: customerData } = await supabase
            .from('customers')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle()
          setCustomer(customerData || null)
        } else {
          setCustomer(null)
        }
      } else {
        setProfile(null)
        setCustomer(null)
      }

      setLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-ink-600 mx-auto mb-4"></div>
          <p className="text-charcoal/60 text-lg">লোড করছি...</p>
        </div>
      </div>
    )
  }

  const isAdmin = profile?.role === 'admin'
  const isStaff = profile?.role === 'staff'
  const isCounterOperator = profile?.role === 'counter_operator'
  const isDashboardUser = isAdmin || isStaff || isCounterOperator

  return (
    <Router>
      <div className="min-h-screen bg-paper">
        <ScrollToHash />
        <Analytics />
        <PublicChrome>
          <SiteBanner />
          <Navbar user={user} profile={profile} customer={customer} />
        </PublicChrome>
        <Suspense fallback={<PageLoader full />}>
        <Routes>
          {/* জনসাধারণের রুট */}
          <Route path="/" element={<Home />} />
          <Route path="/order" element={<OrderForm />} />
          <Route path="/tracking" element={<TrackingStatus />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/prompts" element={<PromptLibrary />} />
          <Route path="/portfolio/:id" element={<PortfolioDetailPage />} />
          <Route path="/service/:id" element={<ServiceDetailPage />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/tickets" element={<TicketRequest />} />
          <Route path="/courses/:slug" element={<CourseDetailPage />} />

          {/* কাস্টমার অ্যাকাউন্ট */}
          <Route
            path="/account/login"
            element={
              !user ? (
                <CustomerLogin />
              ) : isAdmin || isCounterOperator ? (
                <Navigate to="/admin/dashboard" />
              ) : isStaff ? (
                <Navigate to="/staff/dashboard" />
              ) : (
                <Navigate to="/account" />
              )
            }
          />
          <Route
            path="/account"
            element={
              user && !isDashboardUser ? (
                <CustomerDashboard user={user} />
              ) : isAdmin || isCounterOperator ? (
                <Navigate to="/admin/dashboard" />
              ) : isStaff ? (
                <Navigate to="/staff/dashboard" />
              ) : (
                <Navigate to="/account/login" />
              )
            }
          />

          {/* লগইন */}
          <Route
            path="/admin/login"
            element={
              !user ? (
                <AdminLogin />
              ) : isAdmin || isCounterOperator ? (
                <Navigate to="/admin/dashboard" />
              ) : isStaff ? (
                <Navigate to="/staff/dashboard" />
              ) : (
                <AdminLogin />
              )
            }
          />

          {/* অ্যাডমিন রুট (কাউন্টার অপারেটরও এখানে ঢোকে, তবে সীমিত ট্যাব দেখে) */}
          <Route
            path="/admin/dashboard"
            element={
              isAdmin || isCounterOperator ? (
                <AdminDashboard user={user} role={profile?.role} />
              ) : isStaff ? (
                <Navigate to="/staff/dashboard" />
              ) : (
                <Navigate to="/admin/login" />
              )
            }
          />

          {/* স্টাফ রুট */}
          <Route
            path="/staff/dashboard"
            element={
              isStaff ? (
                <StaffDashboard user={user} />
              ) : isAdmin || isCounterOperator ? (
                <Navigate to="/admin/dashboard" />
              ) : (
                <Navigate to="/admin/login" />
              )
            }
          />

          {/* ৪০৪ */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
        <PublicChrome>
          <Footer />
        </PublicChrome>
        <FloatingContact />
        <InstallPrompt />
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      </div>
    </Router>
  )
}
