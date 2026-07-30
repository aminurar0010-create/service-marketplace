import { SiteSettings } from './supabase'

/** hex (#RRGGBB) → "R G B" স্ট্রিং, tailwind rgb(var(--x) / <alpha-value>) ফরম্যাটের জন্য */
function hexToRgbTriplet(hex: string): string | null {
  const clean = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

function hexToHsl(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / d) % 6
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** একটি বেস hex কালার থেকে হালকা→গাঢ় শেড র‍্যাম্প তৈরি করে (lightness টার্গেট অনুযায়ী) */
function shadeFromBase(baseHex: string, targetLightness: number): string {
  const hsl = hexToHsl(baseHex)
  if (!hsl) return baseHex
  const [h, s] = hsl
  return hslToHex(h, s, targetLightness)
}

/** ব্রাউজার document root-এ CSS ভ্যারিয়েবল হিসেবে থিম প্রয়োগ করে (লাইভ, রিলোড ছাড়াই) */
export function applyTheme(settings: Pick<SiteSettings, 'color_primary' | 'color_secondary' | 'color_accent' | 'color_background'>) {
  const root = document.documentElement.style
  const set = (name: string, hex: string) => {
    const triplet = hexToRgbTriplet(hex)
    if (triplet) root.setProperty(name, triplet)
  }

  // primary = ink পরিবার (সবুজ ব্র্যান্ড কালার) — পুরো শেড র‍্যাম্প জেনারেট করা হয়
  set('--ink-600', settings.color_primary)
  set('--ink-50', shadeFromBase(settings.color_primary, 94))
  set('--ink-100', shadeFromBase(settings.color_primary, 85))
  set('--ink-400', shadeFromBase(settings.color_primary, 36))
  set('--ink-700', shadeFromBase(settings.color_primary, 21))
  set('--ink-900', shadeFromBase(settings.color_primary, 11))

  // secondary = seal পরিবার (অ্যাকসেন্ট/সতর্কতা কালার)
  set('--seal-DEFAULT', settings.color_secondary)
  set('--seal-light', shadeFromBase(settings.color_secondary, 51))
  set('--seal-dark', shadeFromBase(settings.color_secondary, 28))

  // accent = brass পরিবার
  set('--brass-DEFAULT', settings.color_accent)
  set('--brass-light', shadeFromBase(settings.color_accent, 61))
  set('--brass-dark', shadeFromBase(settings.color_accent, 33))

  // background = paper পরিবার
  set('--paper-DEFAULT', settings.color_background)
  set('--paper-dark', shadeFromBase(settings.color_background, 92))
}

export const DEFAULT_THEME = {
  color_primary: '#1F4D3D',
  color_secondary: '#9A2B25',
  color_accent: '#C08A28',
  color_background: '#F7F3E8',
}
