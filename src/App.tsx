import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, Profile } from './lib/supabase'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import InstallPrompt from './components/InstallPrompt'
import Analytics from './components/Analytics'

// Pages
import Home from './pages/Home'
import OrderForm from './pages/OrderForm'
import TrackingStatus from './pages/TrackingStatus'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import StaffDashboard from './pages/StaffDashboard'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
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
          .single()

        setProfile(profileData || null)
      } else {
        setProfile(null)
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
        <Navbar user={user} profile={profile} />
        <Routes>
          {/* জনসাধারণের রুট */}
          <Route path="/" element={<Home />} />
          <Route path="/order" element={<OrderForm />} />
          <Route path="/tracking" element={<TrackingStatus />} />

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
      </div>
    </Router>
  )
}
