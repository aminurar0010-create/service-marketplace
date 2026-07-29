import {
  BookImage,
  Car,
  Fingerprint,
  Globe,
  Newspaper,
  PhoneCall,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tv,
  Briefcase,
  BadgeCheck,
} from 'lucide-react'

const govServices = [
  { icon: BadgeCheck, label: 'পাসপোর্ট আবেদন/রিনিউ' },
  { icon: Newspaper, label: 'জন্ম নিবন্ধন সনদ' },
  { icon: Car, label: 'ড্রাইভিং লাইসেন্স' },
  { icon: ShieldCheck, label: 'পুলিশ ক্লিয়ারেন্স সার্টিফিকেট' },
  { icon: Briefcase, label: 'চাকরির আবেদন' },
  { icon: PhoneCall, label: 'মোবাইল নাম্বার ট্র্যাকিং' },
  { icon: Fingerprint, label: 'বায়োমেট্রিক যাচাই' },
]

const digitalServices = [
  { icon: Globe, label: 'ওয়েবসাইট তৈরি' },
  { icon: Smartphone, label: 'মোবাইল অ্যাপ তৈরি' },
  { icon: Sparkles, label: 'এআই অটোমেশন' },
  { icon: Tv, label: 'পেইড সাবস্ক্রিপশন' },
  { icon: BookImage, label: 'লোগো ও গ্রাফিক্স ডিজাইন' },
]

function ServiceChip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-lg border border-sage px-4 py-3 hover:border-brass hover:shadow-md transition">
      <div className="w-9 h-9 rounded-full bg-ink-50 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-ink-600" />
      </div>
      <span className="text-sm font-medium text-charcoal/85">{label}</span>
    </div>
  )
}

export default function DigitalServices() {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="font-stamp text-xs tracking-widest text-seal">অনলাইন সকল প্রকার কাজ</span>
          <h2 className="font-display text-3xl font-bold text-ink-700 mt-2">সরকারি ও ডিজিটাল সেবা</h2>
          <p className="text-charcoal/60 mt-3 max-w-2xl mx-auto">
            সুদক্ষ কারিগর দ্বারা অনলাইনে সকল প্রকার সরকারি কাগজপত্র ও ডিজিটাল কাজ করানো হয়।
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="font-display font-bold text-lg text-ink-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-seal" /> সরকারি সেবা
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {govServices.map((s) => (
                <ServiceChip key={s.label} {...s} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-display font-bold text-lg text-ink-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brass" /> ডিজিটাল সেবা
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {digitalServices.map((s) => (
                <ServiceChip key={s.label} {...s} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
