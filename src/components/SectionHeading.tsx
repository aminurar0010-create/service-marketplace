interface SectionHeadingProps {
  tag?: string
  title: string
  subtitle?: string
  align?: 'left' | 'center' | 'right'
  glow?: boolean
}

export default function SectionHeading({
  tag,
  title,
  subtitle,
  align = 'center',
  glow = true,
}: SectionHeadingProps) {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align]

  return (
    <div className={`mb-12 ${alignClass} animate-fade-in-up`}>
      {/* Tag/Label */}
      {tag && (
        <div className="inline-flex items-center gap-2 mb-4">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <p className="font-mono text-xs tracking-widest uppercase text-indigo-600 dark:text-indigo-400">
            {tag}
          </p>
        </div>
      )}

      {/* Main Title */}
      <h2
        className={`text-4xl md:text-5xl font-bold mb-4 transition-all duration-300 ${
          glow
            ? 'bg-gradient-to-r from-slate-900 via-indigo-600 to-slate-900 dark:from-white dark:via-indigo-400 dark:to-white bg-clip-text text-transparent'
            : 'text-gray-900 dark:text-white'
        }`}
      >
        {title}
      </h2>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}

      {/* Decorative Line */}
      {align === 'center' && (
        <div className="mt-6 flex justify-center">
          <div className="w-12 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full" />
        </div>
      )}

      {/* Animation */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out;
        }
      `}</style>
    </div>
  )
}
