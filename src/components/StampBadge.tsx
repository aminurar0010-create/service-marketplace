interface StampBadgeProps {
  ringText?: string
  centerLine1: string
  centerLine2?: string
  size?: number
  className?: string
  tone?: 'brass' | 'seal'
}

// দোকানের "সীলমোহর" — সাইটের সিগনেচার এলিমেন্ট। SVG দিয়ে বানানো, তাই ঝাপসা হয় না।
export default function StampBadge({
  ringText = 'নিউ প্রিন্টার্স • সুন্দলপুর বাজার • মনিরামপুর',
  centerLine1,
  centerLine2,
  size = 168,
  className = '',
  tone = 'brass',
}: StampBadgeProps) {
  const color = tone === 'brass' ? '#C08A28' : '#9A2B25'
  const id = `stamp-ring-${tone}-${centerLine1.length}`

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={`animate-stamp-in select-none ${className}`}
      role="img"
      aria-label={`${ringText} — ${centerLine1} ${centerLine2 || ''}`}
    >
      <defs>
        <path id={id} d="M 100,100 m -78,0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0" />
      </defs>
      <circle cx="100" cy="100" r="96" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2 4" opacity="0.55" />
      <circle cx="100" cy="100" r="86" fill="none" stroke={color} strokeWidth="2.5" />
      <circle cx="100" cy="100" r="70" fill="none" stroke={color} strokeWidth="1" opacity="0.7" />
      <text fill={color} fontSize="9.5" fontFamily="'Space Mono', monospace" letterSpacing="1.5">
        <textPath href={`#${id}`} startOffset="2%">
          {ringText}
        </textPath>
      </text>
      <text
        x="100"
        y={centerLine2 ? '96' : '104'}
        textAnchor="middle"
        fill={color}
        fontSize="18"
        fontFamily="'Noto Serif Bengali', serif"
        fontWeight="700"
      >
        {centerLine1}
      </text>
      {centerLine2 && (
        <text
          x="100"
          y="118"
          textAnchor="middle"
          fill={color}
          fontSize="12"
          fontFamily="'Noto Sans Bengali', sans-serif"
        >
          {centerLine2}
        </text>
      )}
    </svg>
  )
}
