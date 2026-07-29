import { useState } from 'react'
import { X, ZoomIn } from 'lucide-react'
import shopFront from '../../assets/gallery/shop-front.jpg'
import shopPanel from '../../assets/gallery/shop-panel.jpg'
import shopDesk from '../../assets/gallery/shop-desk.jpg'

const photos = [
  { src: shopFront, alt: 'নিউ প্রিন্টার্স-এর সাইনবোর্ড ও সার্ভিস তালিকা' },
  { src: shopPanel, alt: 'দোকানের সার্ভিস প্যানেল ও প্রিন্টিং সামগ্রী' },
  { src: shopDesk, alt: 'ডিজিটাল সার্ভিস ডেস্ক' },
]

export default function Gallery() {
  const [active, setActive] = useState<number | null>(null)

  return (
    <section className="py-20 px-4 bg-paper">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-stamp text-xs tracking-widest text-seal">দোকান ঘুরে দেখুন</span>
          <h2 className="font-display text-3xl font-bold text-ink-700 mt-2">গ্যালারি</h2>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {photos.map((photo, i) => (
            <button
              key={photo.src}
              onClick={() => setActive(i)}
              className="doc-frame group relative rounded-xl overflow-hidden shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              <img
                src={photo.src}
                alt={photo.alt}
                className="w-full h-64 object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-ink-900/0 group-hover:bg-ink-900/40 transition flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {active !== null && (
        <div
          className="fixed inset-0 z-[60] bg-ink-900/90 flex items-center justify-center p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setActive(null)}
            className="absolute top-6 right-6 text-white/80 hover:text-white"
            aria-label="বন্ধ করুন"
          >
            <X size={28} />
          </button>
          <img
            src={photos[active].src}
            alt={photos[active].alt}
            className="max-h-[85vh] max-w-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  )
}
