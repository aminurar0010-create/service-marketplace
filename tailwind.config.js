/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F7F3E8',
          dark: '#EFE8D6',
        },
        ink: {
          50: '#EAF0EC',
          100: '#CBDACF',
          400: '#3E7A5C',
          600: '#1F4D3D',
          700: '#173B2F',
          900: '#0F2A21',
        },
        seal: {
          DEFAULT: '#9A2B25',
          light: '#C24A3F',
          dark: '#711F1B',
        },
        brass: {
          DEFAULT: '#C08A28',
          light: '#E0B355',
          dark: '#8F6519',
        },
        charcoal: '#21221E',
        sage: '#D8DCC9',
        // legacy alias kept so existing indigo-* classes elsewhere still resolve
        indigo: {
          50: '#EAF0EC',
          600: '#1F4D3D',
          700: '#173B2F',
        },
      },
      fontFamily: {
        display: ['"Noto Serif Bengali"', 'serif'],
        body: ['"Noto Sans Bengali"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      keyframes: {
        'stamp-in': {
          '0%': { transform: 'scale(1.6) rotate(-18deg)', opacity: '0' },
          '60%': { transform: 'scale(0.94) rotate(-8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'stamp-in': 'stamp-in 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
        'fade-up': 'fade-up 0.6s ease-out forwards',
      },
    },
  },
  plugins: [],
}
