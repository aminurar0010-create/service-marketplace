import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Navbar({ user, profile }: { user: any; profile?: any }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // হোমপেজে হিরো সেকশনের ওপরে ন্যাভবার শুরুতে স্বচ্ছ থাকবে, স্ক্রল করলে গাঢ় সবুজ হয়ে যাবে
  const isHome = location.pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const dashboardPath = profile?.role === 'staff' ? '/staff/dashboard' : '/admin/dashboard'
  const dashboardLabel = profile?.role === 'staff' ? 'স্টাফ ড্যাশবোর্ড' : 'ড্যাশবোর্ড'

  const transparent = isHome && !scrolled && !mobileOpen
  const linkTone = transparent ? 'text-white/90 hover:text-white' : 'text-charcoal/80 hover:text-ink-600'

  return (
    <nav
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        transparent ? 'bg-transparent' : 'bg-ink-600 shadow-lg'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl">
            <div className="w-9 h-9 bg-brass rounded-full flex items-center justify-center text-ink-900 font-stamp font-bold border-2 border-white/30">
              নপ
            </div>
            <span className={transparent ? 'text-white' : 'text-white'}>নিউ প্রিন্টার্স</span>
          </Link>

          <div className="hidden md:flex gap-8 items-center">
            <Link to="/" className={`${transparent ? linkTone : 'text-white/90 hover:text-white'} transition`}>
              হোম
            </Link>
            <Link to="/order" className={`${transparent ? linkTone : 'text-white/90 hover:text-white'} transition`}>
              অর্ডার করুন
            </Link>
            <Link to="/tracking" className={`${transparent ? linkTone : 'text-white/90 hover:text-white'} transition`}>
              ট্র্যাক করুন
            </Link>

            {user ? (
              <>
                <Link to={dashboardPath} className={`${transparent ? linkTone : 'text-white/90 hover:text-white'} transition`}>
                  {dashboardLabel}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-seal/90 text-white px-4 py-2 rounded-lg hover:bg-seal transition"
                >
                  <LogOut size={18} />
                  লগআউট
                </button>
              </>
            ) : (
              <Link
                to="/admin/login"
                className="bg-brass text-ink-900 px-4 py-2 rounded-lg hover:bg-brass-light transition font-semibold"
              >
                অ্যাডমিন লগইন
              </Link>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`md:hidden flex items-center gap-2 ${transparent ? 'text-white' : 'text-white'}`}
            aria-label="মেনু খুলুন"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1 bg-ink-600 -mx-4 px-4 rounded-b-xl">
            <Link to="/" className="block text-white/90 hover:text-white py-2">
              হোম
            </Link>
            <Link to="/order" className="block text-white/90 hover:text-white py-2">
              অর্ডার করুন
            </Link>
            <Link to="/tracking" className="block text-white/90 hover:text-white py-2">
              ট্র্যাক করুন
            </Link>
            {user ? (
              <>
                <Link to={dashboardPath} className="block text-white/90 hover:text-white py-2">
                  {dashboardLabel}
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left text-white bg-seal/90 hover:bg-seal py-2 px-2 rounded mt-2"
                >
                  লগআউট
                </button>
              </>
            ) : (
              <Link
                to="/admin/login"
                className="block bg-brass text-ink-900 px-4 py-2 rounded text-center font-semibold mt-2"
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
