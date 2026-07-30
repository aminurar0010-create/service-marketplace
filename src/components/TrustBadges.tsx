import { useEffect, useState } from 'react'
import { ShieldCheck, Star, Clock3, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface PublicStats {
  completed_orders: number
  avg_rating: number
  total_reviews: number
}

// ফেজ ৫ — ট্রাস্ট ব্যাজ: হোমপেজে গ্রাহকের আস্থা বাড়ানোর জন্য একটি বার
// get_public_stats() RPC থেকে আসল সংখ্যা আনার চেষ্টা করে, ব্যর্থ হলে জেনেরিক টেক্সট দেখায়
export default function TrustBadges() {
  const [stats, setStats] = useState<PublicStats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_stats')
        if (!error && data && data[0]) {
          setStats(data[0] as PublicStats)
        }
      } catch (error) {
        // RPC না থাকলে বা ব্যর্থ হলে চুপচাপ জেনেরিক ব্যাজ দেখানো হবে
        console.error('পাবলিক স্ট্যাটস লোড ত্রুটি:', error)
      }
    }
    fetchStats()
  }, [])

  const badges = [
    {
      icon: ShieldCheck,
      title: 'নিরাপদ পেমেন্ট',
      desc: 'বিকাশ, নগদ ও রকেটে নিরাপদ লেনদেন',
    },
    {
      icon: Clock3,
      title: 'সময়মতো ডেলিভারি',
      desc: 'নির্ধারিত সময়ের মধ্যে কাজ বুঝিয়ে দেওয়ার প্রতিশ্রুতি',
    },
    {
      icon: Users,
      title:
        stats && stats.completed_orders > 0
          ? `${stats.completed_orders}+ সম্পন্ন অর্ডার`
          : 'শত শত সন্তুষ্ট গ্রাহক',
      desc: 'নিয়মিত গ্রাহকরা বারবার আমাদের সেবা নিচ্ছেন',
    },
    {
      icon: Star,
      title:
        stats && stats.total_reviews > 0
          ? `${stats.avg_rating} / ৫ রেটিং`
          : 'বিশ্বস্ত সেবা',
      desc:
        stats && stats.total_reviews > 0
          ? `${stats.total_reviews} টি গ্রাহক রিভিউ থেকে`
          : 'বছরের পর বছর ধরে বিশ্বস্ততার সাথে সেবা',
    },
  ]

  return (
    <section className="py-10 px-4 bg-paper border-y border-sage/40">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {badges.map((b) => (
          <div key={b.title} className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center">
              <b.icon className="w-6 h-6 text-ink-600" />
            </div>
            <p className="font-display font-bold text-sm text-charcoal">{b.title}</p>
            <p className="text-xs text-charcoal/60">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
