import { Link } from 'react-router-dom'
import { ShoppingCart, MessageCircle } from 'lucide-react'
import StampBadge from '../../components/StampBadge'
import shopFront from '../../assets/gallery/shop-front.jpg'

const WHATSAPP_NUMBER = '8801968673241'

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={shopFront} alt="নিউ প্রিন্টার্স, সুন্দলপুর বাজার" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-900/85 via-ink-700/80 to-ink-600/90" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-32 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 text-center md:text-left">
          <span className="inline-block font-stamp text-xs tracking-widest text-brass-light border border-brass/50 rounded-full px-3 py-1 mb-5">
            সুন্দলপুর বাজার, মনিরামপুর, যশোর
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
            একটি ঠিকানায় — সরকারি কাগজপত্র,
            <br className="hidden md:block" /> প্রিন্টিং ও ডিজিটাল সেবা
          </h1>
          <p className="text-lg text-ink-50/90 mb-8 max-w-xl md:max-w-none mx-auto md:mx-0">
            পাসপোর্ট আবেদন থেকে ওয়েবসাইট তৈরি — মনিরামপুরে বসেই সুদক্ষ কারিগরের হাতে সব কাজ।
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <Link
              to="/order"
              className="inline-flex items-center justify-center gap-2 bg-brass text-ink-900 px-7 py-3 rounded-lg font-semibold hover:bg-brass-light transition"
            >
              <ShoppingCart size={20} />
              এখনই অর্ডার করুন
            </Link>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/30 text-white px-7 py-3 rounded-lg font-semibold hover:bg-white/20 transition backdrop-blur-sm"
            >
              <MessageCircle size={20} />
              হোয়াটসঅ্যাপে কথা বলুন
            </a>
          </div>
        </div>

        <div className="flex-shrink-0 drop-shadow-2xl">
          <StampBadge centerLine1="বিশ্বস্ত সেবা" centerLine2="এক ঠিকানায়" tone="brass" />
        </div>
      </div>
    </section>
  )
}
