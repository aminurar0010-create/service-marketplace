import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ফেজ ৫ — PWA: ব্রাউজার সাপোর্ট করলে "অ্যাপ হিসেবে ইনস্টল করুন" বাটন দেখায়।
// সাপোর্ট না থাকলে (iOS Safari ইত্যাদি) কিছুই রেন্ডার হয় না — সাইট স্বাভাবিকভাবেই চলবে।
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  const handleInstall = async () => {
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-ink-700 text-white rounded-full shadow-lg pl-5 pr-2 py-2 flex items-center gap-3">
      <span className="text-sm font-semibold">অ্যাপ হিসেবে ইনস্টল করুন</span>
      <button
        onClick={handleInstall}
        className="bg-brass-light text-ink-700 rounded-full p-2 hover:opacity-90 transition"
        aria-label="ইনস্টল করুন"
      >
        <Download className="w-4 h-4" />
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="p-2 text-white/60 hover:text-white transition"
        aria-label="বন্ধ করুন"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
