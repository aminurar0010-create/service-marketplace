import { Landmark, Printer, Sparkles } from 'lucide-react'
import shopPanel from '../../assets/gallery/shop-panel.jpg'

export default function About() {
  return (
    <section className="py-20 px-4 bg-paper">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="doc-frame rounded-xl overflow-hidden shadow-lg">
          <img
            src={shopPanel}
            alt="নিউ প্রিন্টার্স দোকানের সার্ভিস প্যানেল"
            className="w-full h-full object-cover"
          />
        </div>

        <div>
          <span className="font-stamp text-xs tracking-widest text-seal">আমাদের পরিচিতি</span>
          <h2 className="font-display text-3xl font-bold text-ink-700 mt-2 mb-5">
            এক দোকান, তিন ধরনের কাজ
          </h2>
          <p className="text-charcoal/80 leading-relaxed mb-6">
            সুন্দলপুর বাজার, ঈদগাহের পূর্ব পাশে, মনিরামপুর যশোরে অবস্থিত নিউ প্রিন্টার্স একই ছাদের নিচে
            সরকারি কাগজপত্রের কাজ, কাস্টম প্রিন্টিং এবং ডিজিটাল সার্ভিস দিয়ে থাকে। পাসপোর্ট আবেদন, জন্ম
            নিবন্ধন সনদ, ড্রাইভিং লাইসেন্স, পুলিশ ক্লিয়ারেন্স সার্টিফিকেট থেকে শুরু করে ওয়েবসাইট তৈরি ও এআই
            অটোমেশন — সুদক্ষ কারিগরের মাধ্যমে অনলাইনে সব ধরনের কাজ করানো হয়।
          </p>
          <p className="text-charcoal/70 leading-relaxed mb-8 border-l-2 border-brass/60 pl-4">
            লক্ষ্য একটাই — এলাকার মানুষকে সরকারি কাজের জন্য দূরে যেতে না হয়; এক জায়গায় বসেই যেন কাগজপত্র,
            প্রিন্টিং ও ডিজিটাল সেবা পাওয়া যায়।
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <Landmark className="w-8 h-8 text-ink-600 mx-auto mb-2" />
              <p className="text-sm text-charcoal/70">সরকারি কাগজপত্র</p>
            </div>
            <div className="text-center">
              <Printer className="w-8 h-8 text-ink-600 mx-auto mb-2" />
              <p className="text-sm text-charcoal/70">কাস্টম প্রিন্টিং</p>
            </div>
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-ink-600 mx-auto mb-2" />
              <p className="text-sm text-charcoal/70">ডিজিটাল সেবা</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
