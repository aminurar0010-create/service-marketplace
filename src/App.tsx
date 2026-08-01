import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, Profile, Customer } from './lib/supabase'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import InstallPrompt from './components/InstallPrompt'
import Analytics from './components/Analytics'
import ChatWidget from './components/ChatWidget'
import SiteBanner from './components/SiteBanner'

// Pages
import Home from './pages/Home'
import OrderForm from './pages/OrderForm'
import TrackingStatus from './pages/TrackingStatus'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import StaffDashboard from './pages/StaffDashboard'
import CustomerLogin from './pages/CustomerLogin'
import CustomerDashboard from './pages/CustomerDashboard'
import Blog from './pages/Blog'
import BlogPostPage from './pages/BlogPostPage'
import PromptLibrary from './pages/PromptLibrary'

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

  return (
    <Router>
      <div className="min-h-screen bg-paper">
        <Analytics />
        <SiteBanner />
        <Navbar user={user} profile={profile} customer={customer} />
        <Routes>
          {/* জনসাধারণের রুট */}
          <Route path="/" element={<Home />} />
          <Route path="/order" element={<OrderForm />} />
          <Route path="/tracking" element={<TrackingStatus />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/prompts" element={<PromptLibrary />} />

          {/* কাস্টমার অ্যাকাউন্ট */}
          <Route
            path="/account/login"
            element={
              !user ? (
                <CustomerLogin />
              ) : isAdmin ? (
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
              user && !isAdmin && !isStaff ? (
                <CustomerDashboard user={user} />
              ) : isAdmin ? (
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
              ) : isAdmin ? (
                <Navigate to="/admin/dashboard" />
              ) : isStaff ? (
                <Navigate to="/staff/dashboard" />
              ) : (
                <AdminLogin />
              )
            }
          />

          {/* অ্যাডমিন রুট */}
          <Route
            path="/admin/dashboard"
            element={
              isAdmin ? (
                <AdminDashboard user={user} />
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
              ) : isAdmin ? (
                <Navigate to="/admin/dashboard" />
              ) : (
                <Navigate to="/admin/login" />
              )
            }
          />

          {/* ৪০৪ */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Footer />
        <InstallPrompt />
        <ChatWidget />
      </div>
    </Router>
  )
}
