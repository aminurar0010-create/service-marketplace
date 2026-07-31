import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, MessageCircle, ArrowRight } from 'lucide-react'
import StampBadge from '../../components/StampBadge'
import shopFront from '../../assets/gallery/shop-front.jpg'

const WHATSAPP_NUMBER = '8801968673241'

export default function Hero() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section className="relative overflow-hidden min-h-screen flex items-center">
      {/* ব্যাকগ্রাউন্ড ইমেজ + গ্রাডিয়েন্ট */}
      <div className="absolute inset-0">
        <img
          src={shopFront}
          alt="নিউ প্রিন্টার্স, সুন্দলপুর বাজার"
          className="w-full h-full object-cover"
          style={{ transform: `translateY(${scrollY * 0.5}px)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-800/75 to-slate-700/85" />
        {/* গ্লো ইফেক্ট */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* কন্টেন্ট */}
      <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-32 flex flex-col md:flex-row items-center gap-12 w-full">
        {/* বাম দিকের টেক্সট */}
        <div
          className="flex-1 text-center md:text-left"
          style={{
            transform: `translateY(${scrollY * 0.1}px)`,
            opacity: Math.max(0.5, 1 - scrollY / 500),
          }}
        >
          {/* ব্যাজ অ্যানিমেশন */}
          <div className="inline-block mb-6 animate-fade-in-down">
            <div className="inline-flex items-center gap-2 font-mono text-xs tracking-widest text-amber-300 border border-amber-400/50 rounded-full px-4 py-2 bg-amber-400/10 backdrop-blur-sm hover:border-amber-400 transition">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              সুন্দলপুর বাজার, মনিরামপুর, যশোর
            </div>
          </div>

          {/* মূল শিরোনাম */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent animate-fade-in-up">
              একটি ঠিকানায়
            </span>
            <br className="hidden md:block" />
            <span className="text-white">সরকারি কাগজপত্র,</span>
            <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              প্রিন্টিং ও ডিজিটাল সেবা
            </span>
          </h1>

          {/* ডেস্ক্রিপশন */}
          <p className="text-lg md:text-xl text-slate-200 mb-8 max-w-2xl mx-auto md:mx-0 leading-relaxed animate-fade-in">
            পাসপোর্ট আবেদন থেকে ওয়েবসাইট তৈরি — মনিরামপুরে বসেই সুদক্ষ কারিগরের হাতে সব কাজ। 
            <span className="block text-amber-300 mt-2 font-semibold">দ্রুত • বিশ্বস্ত • সাশ্রয়ী</span>
          </p>

          {/* সিটিএ বাটন */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start animate-fade-in-up delay-200">
            <Link
              to="/order"
              className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 px-8 py-4 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              <ShoppingCart size={20} className="group-hover:animate-bounce" />
              এখনই অর্ডার করুন
              <ArrowRight size={18} className="group-hover:translate-x-1 transition" />
            </Link>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-2 bg-white/10 border border-white/30 text-white hover:bg-white/20 px-8 py-4 rounded-lg font-semibold transition-all duration-300 backdrop-blur-sm"
            >
              <MessageCircle size={20} />
              হোয়াটসঅ্যাপে চ্যাট করুন
            </a>
          </div>

          {/* ফিচার পয়েন্টস */}
          <div className="mt-12 grid grid-cols-3 gap-4 md:gap-6 text-center md:text-left">
            {[
              { icon: '📋', label: '৭+ ডিজিটাল সেবা' },
              { icon: '⚡', label: 'দ্রুত ডেলিভারি' },
              { icon: '🔒', label: '১০০% নিরাপদ' },
            ].map((feature, i) => (
              <div key={i} className="text-sm">
                <div className="text-2xl mb-1">{feature.icon}</div>
                <p className="text-slate-300">{feature.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ডান দিকের স্ট্যাম্প ব্যাজ */}
        <div
          className="flex-shrink-0 drop-shadow-2xl hidden md:block"
          style={{
            transform: `translateY(${scrollY * -0.1}px) scale(${Math.min(1, 1 + scrollY / 1000)})`,
          }}
        >
          <StampBadge centerLine1="বিশ্বস্ত সেবা" centerLine2="এক ঠিকানায়" tone="brass" />
        </div>
      </div>

      {/* স্ক্রল ইন্ডিকেটর */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-slate-300 text-xs mb-3 uppercase tracking-widest">নিচে স্ক্রল করুন</p>
        <div className="w-6 h-10 border-2 border-slate-300 rounded-full flex justify-center mx-auto">
          <div className="w-1 h-2 bg-slate-300 rounded-full mt-2 animate-bounce" />
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in-down {
          animation: fadeInDown 0.6s ease-out;
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-fade-in {
          animation: fadeIn 0.8s ease-out 0.2s both;
        }

        .delay-200 {
          animation-delay: 0.4s;
        }
      `}</style>
    </section>
  )
}
