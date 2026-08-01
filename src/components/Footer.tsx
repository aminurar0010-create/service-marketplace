import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-ink-900 text-ink-50/80 pt-14 pb-8 px-4">
      <div className="max-w-7xl mx-auto grid sm:grid-cols-2 md:grid-cols-3 gap-10 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brass rounded-full flex items-center justify-center text-ink-900 font-stamp font-bold text-sm">
              নপ
            </div>
            <span className="font-display font-bold text-white text-lg">নিউ প্রিন্টার্স</span>
          </div>
          <p className="text-sm leading-relaxed">
            সরকারি কাগজপত্র, কাস্টম প্রিন্টিং ও ডিজিটাল সেবা — এক ঠিকানায়, সুদক্ষ কারিগরের হাতে।
          </p>
        </div>

        <div>
          <h3 className="font-display font-semibold text-white mb-4">কুইক লিংক</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="hover:text-brass-light transition">হোম</Link></li>
            <li><Link to="/order" className="hover:text-brass-light transition">অর্ডার করুন</Link></li>
            <li><Link to="/tracking" className="hover:text-brass-light transition">ট্র্যাক করুন</Link></li>
            <li><Link to="/blog" className="hover:text-brass-light transition">ব্লগ</Link></li>
            <li><Link to="/prompts" className="hover:text-brass-light transition">AI প্রম্পট লাইব্রেরি</Link></li>
            <li><Link to="/account/login" className="hover:text-brass-light transition">আমার অ্যাকাউন্ট</Link></li>
            <li><Link to="/admin/login" className="hover:text-brass-light transition">অ্যাডমিন লগইন</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-display font-semibold text-white mb-4">যোগাযোগ</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2">
              <Phone size={15} className="text-brass-light flex-shrink-0" />
              <a href="tel:01968673241" className="hover:text-brass-light transition">01968673241</a>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={15} className="text-brass-light flex-shrink-0" />
              <a href="mailto:newprintssmj@gmail.com" className="hover:text-brass-light transition">
                newprintssmj@gmail.com
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin size={15} className="text-brass-light flex-shrink-0 mt-0.5" />
              <span>সুন্দলপুর বাজার, ঈদগাহের পূর্ব পাশে, মনিরামপুর, যশোর</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t border-white/10 pt-6 text-center text-xs text-ink-50/50">
        © {year} নিউ প্রিন্টার্স। সর্বস্বত্ব সংরক্ষিত।
      </div>
    </footer>
  )
}
