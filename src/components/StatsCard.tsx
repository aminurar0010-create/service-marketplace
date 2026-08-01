import { LucideIcon } from 'lucide-react'
import { TrendingUp } from 'lucide-react'
interface StatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: number
  bgGradient: string
  textColor: string
  onClick?: () => void
}
export default function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  bgGradient,
  onClick,
}: StatsCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group bg-gradient-to-br ${bgGradient} rounded-2xl p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden relative cursor-pointer ${
        onClick ? 'hover:shadow-2xl' : ''
      }`}
    >
      {/* Background Decoration Circle */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform duration-300" />
      {/* Content */}
      <div className="relative z-10">
        {/* Header: Icon + Trend */}
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 bg-white/20 rounded-xl group-hover:bg-white/30 transition-all duration-300">
            <Icon size={28} className="opacity-90" />
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
              <TrendingUp size={14} className="transform group-hover:translate-y-1 transition" />
              <span>+{trend}%</span>
            </div>
          )}
        </div>
        {/* Label */}
        <p className="text-sm font-medium opacity-90 mb-2 uppercase tracking-widest">
          {label}
        </p>
        {/* Value */}
        <p className="text-4xl md:text-5xl font-bold tracking-tight group-hover:scale-105 transition-transform duration-300 origin-left">
          {value}
        </p>
        {/* Bottom Border Animation */}
        <div className="mt-4 h-1 w-0 group-hover:w-8 bg-white/60 rounded-full transition-all duration-300" />
      </div>
      {/* Hover Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  )
}
