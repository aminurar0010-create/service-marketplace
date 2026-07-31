import { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'

interface ServiceCardProps {
  title: string
  description: string
  icon: LucideIcon
  price?: string
  delay?: number
  onClick?: () => void
}

export default function ServiceCard({
  title,
  description,
  icon: Icon,
  price,
  delay = 0,
  onClick,
}: ServiceCardProps) {
  const animationDelay = `${delay * 0.15}s`

  return (
    <div
      onClick={onClick}
      className="group"
      style={{ animation: `fadeInUp 0.6s ease-out ${animationDelay} both` }}
    >
      <div className="relative h-full bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 hover:border-indigo-300 cursor-pointer overflow-hidden">
        {/* Background Glow */}
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-100 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 blur-2xl" />

        {/* Dark overlay for better text on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />

        {/* Content */}
        <div className="relative z-10">
          {/* Icon */}
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg">
            <Icon className="w-8 h-8 text-white" />
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors duration-300">
            {title}
          </h3>

          {/* Description */}
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            {description}
          </p>

          {/* Price (if available) */}
          {price && (
            <p className="text-2xl font-bold text-indigo-600 mb-4">
              {price}
              <span className="text-xs text-gray-500 font-normal ml-1">/প্রতিটি</span>
            </p>
          )}

          {/* CTA */}
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm group-hover:gap-3 transition-all duration-300">
            <span>আরও জানুন</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Top Border Animation */}
        <div className="absolute top-0 left-0 h-1 w-0 bg-gradient-to-r from-indigo-400 to-blue-500 group-hover:w-full transition-all duration-500" />
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
