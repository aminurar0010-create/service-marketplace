import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// ফেজ ৪-ক: মূল মেনু ৬টি; ব্লগ ও AI প্রম্পট "আরও"-তে (পেজ ও রুট অপরিবর্তিত)
const MAIN_LINKS = [
  { to: '/#services', label: 'সেবা' },
  { to: '/order', label: 'অর্ডার করুন' },
  { to: '/tracking', label: 'ট্র্যাক করুন' },
  { to: '/tickets', label: 'টিকিট' },
  { to: '/courses', label: 'ট্রেনিং' },
  { to: '/#contact', label: 'যোগাযোগ' },
]
const MORE_LINKS = [
  { to: '/blog', label: 'ব্লগ' },
  { to: '/prompts', label: 'AI প্রম্পট' },
]

export default function Navbar({ user, profile, customer }: { user: any; profile?: any; customer?: any }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

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
    setMoreOpen(false)
  }, [location.pathname, location.hash])

  // "আরও" ড্রপডাউন: বাইরে ক্লিক বা Esc চাপলে বন্ধ
  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const isStaffOrAdmin = profile?.role === 'staff' || profile?.role === 'admin' || profile?.role === 'counter_operator'
  const dashboardPath = profile?.role === 'staff' ? '/staff/dashboard' : '/admin/dashboard'
  const dashboardLabel =
    profile?.role === 'staff' ? 'স্টাফ ড্যাশবোর্ড' : profile?.role === 'counter_operator' ? 'কাউন্টার ড্যাশবোর্ড' : 'ড্যাশবোর্ড'
  const isCustomer = !!user && !isStaffOrAdmin

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

          <div className="hidden md:flex gap-5 lg:gap-7 items-center text-[15px]">
            {MAIN_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className={`${transparent ? linkTone : 'text-white/90 hover:text-white'} transition whitespace-nowrap`}>
                {l.label}
              </Link>
            ))}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={moreOpen}
                className={`flex items-center gap-1 ${transparent ? linkTone : 'text-white/90 hover:text-white'} transition`}
              >
                আরও
                <ChevronDown size={15} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div className="absolute right-0 mt-3 w-40 bg-ink-600 rounded-lg shadow-xl border border-white/10 py-1 z-50">
                  {MORE_LINKS.map((l) => (
                    <Link key={l.to} to={l.to} className="block px-4 py-2 text-white/90 hover:text-white hover:bg-white/10 transition">
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {isStaffOrAdmin ? (
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
            ) : isCustomer ? (
              <>
                <Link to="/account" className={`${transparent ? linkTone : 'text-white/90 hover:text-white'} transition`}>
                  {customer?.full_name ? customer.full_name.split(' ')[0] : 'আমার অ্যাকাউন্ট'}
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
                to="/account/login"
                className="bg-brass text-ink-900 px-4 py-2 rounded-lg hover:bg-brass-light transition font-semibold"
              >
                আমার অ্যাকাউন্ট
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
            {MAIN_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="block text-white/90 hover:text-white py-2.5">
                {l.label}
              </Link>
            ))}
            <div className="border-t border-white/10 pt-2 mt-1">
              <p className="text-xs text-white/50 py-1">আরও</p>
              {MORE_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className="block text-white/80 hover:text-white py-2">
                  {l.label}
                </Link>
              ))}
            </div>
            {isStaffOrAdmin ? (
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
            ) : isCustomer ? (
              <>
                <Link to="/account" className="block text-white/90 hover:text-white py-2">
                  {customer?.full_name || 'আমার অ্যাকাউন্ট'}
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
                to="/account/login"
                className="block bg-brass text-ink-900 px-4 py-2 rounded text-center font-semibold mt-2"
              >
                আমার অ্যাকাউন্ট
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
