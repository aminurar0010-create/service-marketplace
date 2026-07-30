import { useEffect, useState } from 'react'
import { supabase, Service } from '../lib/supabase'
import { Link } from 'react-router-dom'
import Hero from './home/Hero'
import TrustBadges from '../components/TrustBadges'
import About from './home/About'
import DigitalServices from './home/DigitalServices'
import WhyChooseUs from './home/WhyChooseUs'
import Gallery from './home/Gallery'
import Contact from './home/Contact'

// সার্ভিসের নাম অনুযায়ী ইমোজি বাছাই করার ফাংশন
const getServiceEmoji = (name: string) => {
  const emojiMap: { [key: string]: string } = {
    'ওয়েব ডেভেলপমেন্ট': '💻',
    'ডিজিটাল মার্কেটিং': '📢',
    'গ্রাফিক্স ডিজাইন': '🎨',
    'এআই অটোমেশন': '🤖',
    'এনআইডি সংশোধন': '🪪',
    'ভাড়াটিয়া আবেদন সহায়তা': '🏠',
    'জন্ম নিবন্ধন সনদ': '📋',
    'ট্রেড লাইসেন্স সার্টিফিকেট': '📄',
    'পাসপোর্ট আবেদন/রিনিউ': '🛂',
    'পাসপোর্ট রিনিউ': '🛂',
    'পুলিশ ক্লিয়ারেন্স সার্টিফিকেট': '👮',
    'মিউটেশন (নামজারি)': '📜',
    'আর্টিস্ট কার্ড': '🎴',
    'কাস্টম টি শার্ট': '👕',
    'ডিজিটাল কার্ড': '💳',
    'মগ প্রিন্টিং': '☕',
    'লোগো ডিজাইন': '🖼️',
    'সাইনবোর্ড': '🪧',
  }
  return emojiMap[name] || '🔧'
}

export default function Home() {
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

  const groupedServices = services.reduce((groups: Record<string, Service[]>, service) => {
    const category = service.category || 'অন্যান্য'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(service)
    return groups
  }, {})

  const categoryNames = Object.keys(groupedServices).sort()

  return (
    <div className="min-h-screen bg-paper">
      <Hero />
      <TrustBadges />
      <About />
      <DigitalServices />

      {/* সার্ভিস ক্যাটালগ - ক্যাটাগরি অনুযায়ী গ্রুপকৃত, অর্ডার করার জন্য */}
      <div className="py-20 px-4 bg-paper">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
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
            <div className="space-y-16">
              {categoryNames.map((categoryName) => (
                <div key={categoryName}>
                  <div className="flex items-center gap-4 mb-8">
                    <h3 className="text-2xl font-bold text-charcoal">{categoryName}</h3>
                    <div className="flex-1 h-px bg-sage"></div>
                    <span className="text-sm text-charcoal/40">
                      {groupedServices[categoryName].length} টি সেবা
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {groupedServices[categoryName].map((service) => (
                      <div key={service.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition doc-frame">
                        {service.image_url ? (
                          <div className="h-40 overflow-hidden">
                            <img
                              src={service.image_url}
                              alt={service.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="bg-gradient-to-r from-ink-600 to-ink-700 h-32 flex items-center justify-center">
                            <div className="text-5xl">{getServiceEmoji(service.name)}</div>
                          </div>
                        )}
                        <div className="p-6">
                          <h3 className="text-xl font-bold mb-2 text-charcoal">{service.name}</h3>
                          <p className="text-charcoal/60 mb-4">{service.description}</p>
                          <div className="flex justify-between items-center mb-4">
                            <span className="bg-ink-50 text-ink-700 px-3 py-1 rounded-full text-sm">
                              {service.category}
                            </span>
                            <span className="text-2xl font-bold text-ink-600 font-stamp">
                              ৳{service.price}
                            </span>
                          </div>
                          <Link
                            to={`/order?service=${service.id}`}
                            className="w-full block text-center bg-ink-600 text-white py-2 rounded-lg hover:bg-ink-700 transition font-semibold"
                          >
                            অর্ডার করুন
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
