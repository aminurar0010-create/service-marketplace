import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// URL-এ #hash থাকলে (যেমন /#services বা /#portfolio) সেই সেকশনে স্মুথলি স্ক্রল করে —
// রিভার্স-নেভিগেশন (সার্ভিস ডিটেইল/পোর্টফোলিও ডিটেইল থেকে "সব দেখুন" লিংকে ফিরে আসার) জন্য দরকার
export default function ScrollToHash() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    if (!hash) return
    const id = hash.replace('#', '')
    // রাউট বদলে নতুন পেজ রেন্ডার হওয়ার পর এলিমেন্টটা DOM-এ বসতে একটু সময় লাগে
    const timer = setTimeout(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => clearTimeout(timer)
  }, [hash, pathname])

  return null
}
