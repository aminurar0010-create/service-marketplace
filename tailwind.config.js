/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ফেজ ৪: এই কালারগুলো CSS ভ্যারিয়েবল থেকে আসে (দেখুন src/index.css)
        // যাতে অ্যাডমিন প্যানেলের "লাইভ থিম কাস্টমাইজেশন" থেকে রঙ বদলালে
        // পুরো সাইটের bg-ink-600 / text-seal-DEFAULT ইত্যাদি সব ক্লাস
        // রিয়েল-টাইমে আপডেট হয়ে যায় — কোনো রিবিল্ড দরকার হয় না।
        paper: {
          DEFAULT: 'rgb(var(--paper-DEFAULT) / <alpha-value>)',
          dark: 'rgb(var(--paper-dark) / <alpha-value>)',
        },
        ink: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
        },
        seal: {
          DEFAULT: 'rgb(var(--seal-DEFAULT) / <alpha-value>)',
          light: 'rgb(var(--seal-light) / <alpha-value>)',
          dark: 'rgb(var(--seal-dark) / <alpha-value>)',
        },
        brass: {
          DEFAULT: 'rgb(var(--brass-DEFAULT) / <alpha-value>)',
          light: 'rgb(var(--brass-light) / <alpha-value>)',
          dark: 'rgb(var(--brass-dark) / <alpha-value>)',
        },
        charcoal: '#21221E',
        sage: '#D8DCC9',
        // legacy alias kept so existing indigo-* classes elsewhere still resolve
        indigo: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
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
