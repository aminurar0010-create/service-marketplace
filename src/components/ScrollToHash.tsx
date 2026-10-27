import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// URL-এ #hash থাকলে (যেমন /#services, /#contact) সেই সেকশনে স্মুথলি স্ক্রল করে —
// রিভার্স-নেভিগেশন (সার্ভিস ডিটেইল/পোর্টফোলিও ডিটেইল থেকে "সব দেখুন" লিংকে ফিরে আসার) ও নেভবারের "সেবা"/"যোগাযোগ"-এর জন্য দরকার।
// পেজের নিচের অংশ (লেজি ছবি/সেকশন) পরে লোড হয়ে উচ্চতা বাড়ালে গন্তব্য সরে যায়, তাই কয়েকবার মিলিয়ে নেওয়া হয়;
// ব্যবহারকারী নিজে স্ক্রল/টাচ করলে আর জোর করা হয় না।
export default function ScrollToHash() {
  const { hash, pathname, key } = useLocation()

  useEffect(() => {
    if (!hash) return
    const id = hash.replace('#', '')
    let cancelled = false
    const cancel = () => {
      cancelled = true
    }
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchstart', cancel, { passive: true })
    window.addEventListener('keydown', cancel)

    // রাউট বদলে নতুন পেজ রেন্ডার হওয়ার পর এলিমেন্টটা DOM-এ বসতে একটু সময় লাগে
    const timers = [80, 700, 1400, 2400].map((delay, i) =>
      setTimeout(() => {
        if (cancelled) return
        const el = document.getElementById(id)
        if (!el) return
        // প্রথমবার সবসময়; পরের বারগুলোতে শুধু তখনই, যখন লেআউট সরে গিয়ে গন্তব্য থেকে দূরে চলে গেছে
        if (i === 0 || Math.abs(el.getBoundingClientRect().top) > 60) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, delay),
    )

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
      window.removeEventListener('keydown', cancel)
    }
  }, [hash, pathname, key]) // key: একই #hash-এ আবার ক্লিক করলেও স্ক্রল হবে

  return null
}
