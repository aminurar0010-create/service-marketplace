import { LayoutGrid, Wrench, MessageCircle, Search } from 'lucide-react'

const points = [
  {
    icon: LayoutGrid,
    title: 'সব সেবা এক জায়গায়',
    desc: 'সরকারি কাগজপত্র, প্রিন্টিং ও ডিজিটাল সেবা — একই দোকানে সব কাজ।',
  },
  {
    icon: Wrench,
    title: 'সুদক্ষ কারিগর',
    desc: 'অনলাইনে প্রতিটি কাজ প্রশিক্ষিত কারিগরের মাধ্যমে করানো হয়।',
  },
  {
    icon: MessageCircle,
    title: 'সরাসরি যোগাযোগ',
    desc: 'ফোন বা হোয়াটসঅ্যাপে সরাসরি কথা বলে কাজের অগ্রগতি জানা যায়।',
  },
  {
    icon: Search,
    title: 'অর্ডার ট্র্যাকিং',
    desc: 'অর্ডার দেওয়ার পর ট্র্যাকিং আইডি দিয়ে স্ট্যাটাস যেকোনো সময় চেক করা যায়।',
  },
]

export default function WhyChooseUs() {
  return (
    <section className="py-20 px-4 bg-ink-600 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(247,243,232,0.9) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="max-w-7xl mx-auto relative">
        <div className="text-center mb-14">
          <span className="font-stamp text-xs tracking-widest text-brass-light">কেন আমরা</span>
          <h2 className="font-display text-3xl font-bold text-white mt-2">কেন আমাদের বেছে নিবেন?</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {points.map((p) => (
            <div key={p.title} className="bg-white/5 border border-white/15 rounded-xl p-6 text-center backdrop-blur-sm">
              <p.icon className="w-10 h-10 text-brass-light mx-auto mb-4" />
              <h3 className="font-display font-bold text-lg text-white mb-2">{p.title}</h3>
              <p className="text-ink-50/80 text-sm">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
