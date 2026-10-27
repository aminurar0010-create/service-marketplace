import { useEffect, useState } from 'react'
import { supabase, Service } from '../lib/supabase'
import { Link } from 'react-router-dom'
import Hero from './home/Hero'
import TrustBadges from '../components/TrustBadges'
import About from './home/About'
import Divisions from './home/Divisions'
import DigitalServices from './home/DigitalServices'
import Portfolio from './home/Portfolio'
import WhyChooseUs from './home/WhyChooseUs'
import Gallery from './home/Gallery'
import Contact from './home/Contact'
import ServiceCatalog from '../components/ServiceCatalog'
import { useSEO } from '../lib/useSEO'

export default function Home() {
  useSEO(
    'নিউ প্রিন্টার্স — ডিজিটাল সেবা, প্রিন্টিং, আইটি সমাধান ও প্রশিক্ষণ',
    'সুন্দলপুর বাজার, মনিরামপুর, যশোর — ডিজিটাল সেবা, প্রিন্টিং, আইটি সমাধান ও প্রশিক্ষণ, সবকিছু এক ঠিকানায়।'
  )
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('সার্ভিস লোড করতে ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <Hero />
      <TrustBadges />
      <Divisions />
      <About />
      <DigitalServices />

      {/* সার্ভিস ক্যাটালগ - ক্যাটাগরি অনুযায়ী গ্রুপকৃত, অর্ডার করার জন্য */}
      <div id="services" className="py-14 sm:py-20 px-4 bg-paper">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <span className="font-stamp text-xs tracking-widest text-seal">অর্ডার করুন</span>
            <h2 className="font-display text-3xl font-bold text-ink-700 mt-2">আমাদের সেবাসমূহ</h2>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink-600 mx-auto"></div>
              <p className="text-charcoal/50 mt-4">সেবা লোড করছি...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-charcoal/50 text-lg">কোনো সেবা পাওয়া যায়নি</p>
            </div>
          ) : (
            <ServiceCatalog services={services} />
          )}
        </div>
      </div>

      <Portfolio />
      <WhyChooseUs />
      <Gallery />
      <Contact />

      {/* কল টু এক্শন */}
      <div className="bg-seal text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold mb-4">আপনার অর্ডার এখনই শুরু করুন</h2>
          <p className="text-white/85 mb-6 text-lg">
            দোকানে না এসেই অনলাইনে অর্ডার দিয়ে রাখুন
          </p>
          <Link
            to="/order"
            className="inline-block bg-white text-seal px-8 py-3 rounded-lg font-semibold hover:bg-paper transition"
          >
            এখনই শুরু করুন
          </Link>
        </div>
      </div>
    </div>
  )
}
