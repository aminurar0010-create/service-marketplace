import { Link } from 'react-router-dom'
import { Smartphone, Printer, Monitor, GraduationCap } from 'lucide-react'

const DIVISIONS = [
  {
    icon: Smartphone,
    title: 'Digital Services',
    bn: 'ডিজিটাল সেবা',
    desc: 'পাসপোর্ট, জন্ম নিবন্ধন, ড্রাইভিং লাইসেন্স, পুলিশ ক্লিয়ারেন্সসহ অনলাইন আবেদন।',
    to: '/#services',
  },
  {
    icon: Printer,
    title: 'Printing & Design',
    bn: 'প্রিন্টিং ও ডিজাইন',
    desc: 'প্রিন্ট, ফটোকপি, ল্যামিনেশন, আইডি কার্ড, ব্যানার ও কাস্টম ডিজাইন।',
    to: '/#services',
  },
  {
    icon: Monitor,
    title: 'IT Solution',
    bn: 'আইটি সমাধান',
    desc: 'ওয়েবসাইট তৈরি, কম্পিউটার ও প্রিন্টার সার্ভিস, এআই অটোমেশন।',
    to: '/order',
  },
  {
    icon: GraduationCap,
    title: 'Training Center',
    bn: 'প্রশিক্ষণ কেন্দ্র',
    desc: 'কম্পিউটার ও আইটি বিষয়ে ৩ ও ৬ মাসের হাতেকলমে কোর্স।',
    to: '/courses',
  },
]

/** ব্র্যান্ড প্রমিজ ও ৪টি বিভাগ */
export default function Divisions() {
  return (
    <section className="py-14 sm:py-20 px-4 bg-paper">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <span className="font-stamp text-xs tracking-widest text-seal">নিউ প্রিন্টার্স — আইটি সলিউশন এ্যান্ড ট্রেনিং সেন্টার</span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-700 mt-2 max-w-3xl mx-auto leading-snug">
            ডিজিটাল সেবা, প্রিন্টিং, আইটি সমাধান ও প্রশিক্ষণ—সবকিছু এক ঠিকানায়।
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {DIVISIONS.map((d) => {
            const Icon = d.icon
            return (
              <Link
                key={d.title}
                to={d.to}
                className="group bg-white rounded-xl border border-ink-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition p-6"
              >
                <Icon className="w-9 h-9 text-ink-600 mb-4 group-hover:text-seal transition" />
                <h3 className="font-display font-bold text-lg text-ink-700">{d.title}</h3>
                <p className="text-xs text-seal font-semibold mb-2">{d.bn}</p>
                <p className="text-sm text-charcoal/70 leading-relaxed">{d.desc}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
