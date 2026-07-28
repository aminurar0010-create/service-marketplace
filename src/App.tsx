import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'

// Pages
import Home from './pages/Home'
import OrderForm from './pages/OrderForm'
import TrackingStatus from './pages/TrackingStatus'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // অ্যাডমিন সেশন চেক করুন
    supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">লোড করছি...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} />
        <Routes>
          {/* জনসাধারণের রুট */}
          <Route path="/" element={<Home />} />
          <Route path="/order" element={<OrderForm />} />
          <Route path="/tracking" element={<TrackingStatus />} />

          {/* অ্যাডমিন রুট */}
          <Route path="/admin/login" element={user ? <Navigate to="/admin/dashboard" /> : <AdminLogin />} />
          <Route path="/admin/dashboard" element={user ? <AdminDashboard user={user} /> : <Navigate to="/admin/login" />} />

          {/* ৪০৪ */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  )
}
