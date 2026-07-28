import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function Navbar({ user, profile }: { user: any; profile?: any }) {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const dashboardPath = profile?.role === 'staff' ? '/staff/dashboard' : '/admin/dashboard'
  const dashboardLabel = profile?.role === 'staff' ? 'স্টাফ ড্যাশবোর্ড' : 'ড্যাশবোর্ড'

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              S
            </div>
            ServiceMarket
          </Link>

          <div className="hidden md:flex gap-8 items-center">
            <Link to="/" className="text-gray-700 hover:text-indigo-600 transition">
              হোম
            </Link>
            <Link to="/order" className="text-gray-700 hover:text-indigo-600 transition">
              অর্ডার করুন
            </Link>
            <Link to="/tracking" className="text-gray-700 hover:text-indigo-600 transition">
              ট্র্যাক করুন
            </Link>

            {user ? (
              <>
                <Link to={dashboardPath} className="text-gray-700 hover:text-indigo-600 transition">
                  {dashboardLabel}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition"
                >
                  <LogOut size={18} />
                  লগআউট
                </button>
              </>
            ) : (
              <Link
                to="/admin/login"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                অ্যাডমিন লগইন
              </Link>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex items-center gap-2"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link to="/" className="block text-gray-700 hover:text-indigo-600 py-2">
              হোম
            </Link>
            <Link to="/order" className="block text-gray-700 hover:text-indigo-600 py-2">
              অর্ডার করুন
            </Link>
            <Link to="/tracking" className="block text-gray-700 hover:text-indigo-600 py-2">
              ট্র্যাক করুন
            </Link>
            {user ? (
              <>
                <Link to={dashboardPath} className="block text-gray-700 hover:text-indigo-600 py-2">
                  {dashboardLabel}
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left text-red-600 hover:bg-red-50 py-2 px-2 rounded"
                >
                  লগআউট
                </button>
              </>
            ) : (
              <Link
                to="/admin/login"
                className="block bg-indigo-600 text-white px-4 py-2 rounded text-center"
              >
                অ্যাডমিন লগইন
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
