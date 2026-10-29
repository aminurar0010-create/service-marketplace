import { Check } from 'lucide-react'
import { STEPS } from './types'

interface StepIndicatorProps {
  current: number
  maxReached: number
  onGo: (index: number) => void
}

// ৫ ধাপের সূচক। যে ধাপে একবার পৌঁছেছেন সেখানে ট্যাপ করে ফেরা যায়; সামনের অদেখা ধাপে নয়।
export default function StepIndicator({ current, maxReached, onGo }: StepIndicatorProps) {
  return (
    <ol className="flex items-start justify-between mb-6" aria-label="অর্ডারের ধাপ">
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        const reachable = i <= maxReached && !active
        return (
          <li key={s.id} className="flex-1 flex flex-col items-center relative" aria-current={active ? 'step' : undefined}>
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${i <= current ? 'bg-ink-600' : 'bg-gray-200'}`}
              />
            )}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onGo(i)}
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition ${
                active
                  ? 'bg-ink-600 border-ink-600 text-white'
                  : done
                  ? 'bg-ink-600 border-ink-600 text-white hover:bg-ink-700'
                  : reachable
                  ? 'bg-white border-ink-600 text-ink-600'
                  : 'bg-white border-gray-300 text-gray-400'
              } ${reachable ? 'cursor-pointer' : 'cursor-default'}`}
              aria-label={`ধাপ ${i + 1}: ${s.label}`}
            >
              {done ? <Check className="w-4 h-4" /> : i + 1}
            </button>
            <span className={`mt-1.5 text-[11px] sm:text-xs ${active ? 'font-bold text-ink-700' : 'text-gray-500'}`}>
              {s.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
