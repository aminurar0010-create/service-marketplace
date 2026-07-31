import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useSiteSettings } from '../lib/ThemeContext'

declare global {
  interface Window {
    dataLayer: any[]
    gtag: (...args: any[]) => void
    fbq: (...args: any[]) => void
  }
}

// ফেজ ৫ — অ্যানালিটিক্স/পিক্সেল ইন্টিগ্রেশন
// অ্যাডমিন সেটিংস থেকে বসানো GA4 Measurement ID ও Facebook Pixel ID অনুযায়ী
// স্ক্রিপ্ট ডায়নামিকভাবে লোড করে এবং প্রতিটা পেজ ভিজিটে পেজভিউ পাঠায়।
// কোনো ID বসানো না থাকলে কিছুই লোড হবে না — সাইটের পারফরম্যান্সে প্রভাব পড়বে না।
export default function Analytics() {
  const { settings } = useSiteSettings()
  const location = useLocation()
  const gaLoadedFor = useRef<string | null>(null)
  const fbLoadedFor = useRef<string | null>(null)

  // GA4 স্ক্রিপ্ট লোড (একবারই, ID বদলালে আবার)
  useEffect(() => {
    const gaId = settings?.ga_measurement_id?.trim()
    if (!gaId || gaLoadedFor.current === gaId) return

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
    document.head.appendChild(script)

    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', gaId, { send_page_view: false })

    gaLoadedFor.current = gaId
  }, [settings?.ga_measurement_id])

  // Facebook Pixel স্ক্রিপ্ট লোড (একবারই, ID বদলালে আবার)
  useEffect(() => {
    const pixelId = settings?.fb_pixel_id?.trim()
    if (!pixelId || fbLoadedFor.current === pixelId) return

    /* eslint-disable */
    ;(function (f: any, b: any, e: any, v: any) {
      if (f.fbq) return
      let n: any = (f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      })
      if (!f._fbq) f._fbq = n
      n.push = n
      n.loaded = true
      n.version = '2.0'
      n.queue = []
      const t = b.createElement(e)
      t.async = true
      t.src = v
      const s = b.getElementsByTagName(e)[0]
      s.parentNode.insertBefore(t, s)
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    /* eslint-enable */

    window.fbq('init', pixelId)
    fbLoadedFor.current = pixelId
  }, [settings?.fb_pixel_id])

  // প্রতিটা রুট পরিবর্তনে পেজভিউ পাঠানো
  useEffect(() => {
    if (settings?.ga_measurement_id && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_title: document.title,
      })
    }
    if (settings?.fb_pixel_id && window.fbq) {
      window.fbq('track', 'PageView')
    }
  }, [location.pathname, location.search, settings?.ga_measurement_id, settings?.fb_pixel_id])

  return null
}

// অর্ডার সম্পন্ন হলে বা গুরুত্বপূর্ণ কাজে (যেমন অর্ডার সাবমিট) কল করার জন্য হেল্পার
export function trackEvent(gaEventName: string, fbEventName?: string, params?: Record<string, any>) {
  if (window.gtag) window.gtag('event', gaEventName, params || {})
  if (fbEventName && window.fbq) window.fbq('track', fbEventName, params || {})
}
