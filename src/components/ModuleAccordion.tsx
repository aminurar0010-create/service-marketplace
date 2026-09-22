import { useState } from 'react'
import { ChevronDown, CheckCircle2 } from 'lucide-react'
import { CourseModule } from '../lib/supabase'

export default function ModuleAccordion({ modules }: { modules: CourseModule[] }) {
  const [openId, setOpenId] = useState<string | null>(modules[0]?.id ?? null)

  if (modules.length === 0) {
    return <p className="text-charcoal/50 text-sm">এই কোর্সের সিলেবাস শীঘ্রই যুক্ত করা হবে।</p>
  }

  return (
    <div className="space-y-2">
      {modules.map((mod, idx) => {
        const isOpen = openId === mod.id
        return (
          <div key={mod.id} className="border border-ink-100 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setOpenId(isOpen ? null : mod.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink-50/50 transition"
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-ink-50 text-ink-600 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-semibold text-charcoal text-sm sm:text-base">{mod.title}</span>
              </div>
              <ChevronDown
                size={18}
                className={`text-charcoal/40 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-1 pl-14">
                {mod.description ? (
                  <p className="text-charcoal/60 text-sm">{mod.description}</p>
                ) : (
                  <p className="flex items-center gap-2 text-charcoal/60 text-sm">
                    <CheckCircle2 size={15} className="text-seal" />
                    কোর্স কারিকুলামের অংশ হিসেবে হাতে-কলমে শেখানো হবে
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
