import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Phone, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

// সেটিংস না পেলে Contact সেকশনের মতোই এই ডিফল্ট ব্যবহার হয়
const DEFAULT_PHONE = '01968673241'
const DEFAULT_WHATSAPP = '8801968673241'

/** শুধু অঙ্ক রেখে wa.me-র জন্য নম্বর বানায়; ০১… হলে ৮৮ যোগ করে */
function toWaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('880')) return digits
  if (digits.startsWith('0')) return `88${digits}`
  return digits
}

/**
 * সব পাবলিক পেজে ফ্লোটিং কল + WhatsApp বোতাম।
 * - নম্বর site_settings থেকে (contact_phone / contact_whatsapp), কোডে শুধু ডিফল্ট
 * - বাম দিকে বসে; ডান দিকে ChatWidget-এর বাবল ও প্যানেল থাকে, তাই জায়গা মেলে
 * - অ্যাডমিন/স্টাফ ড্যাশবোর্ডে দেখায় না
 */
export default function FloatingContact() {
  const { pathname } = useLocation()
  const [phone, setPhone] = useState(DEFAULT_PHONE)
  const [whatsapp, setWhatsapp] = useState(DEFAULT_WHATSAPP)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('contact_phone, contact_whatsapp')
          .eq('id', 1)
          .maybeSingle()
        if (!active) return
        if (data?.contact_phone) setPhone(data.contact_phone)
        if (data?.contact_whatsapp) setWhatsapp(data.contact_whatsapp)
      } catch (error) {
        console.error('ফ্লোটিং যোগাযোগ তথ্য লোড ত্রুটি:', error)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  if (pathname.startsWith('/admin') || pathname.startsWith('/staff')) return null

  const waNumber = toWaNumber(whatsapp || phone)
  const telNumber = phone.replace(/[^\d+]/g, '')

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-3 print:hidden">
      <a
        href={`https://wa.me/${waNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="হোয়াটসঅ্যাপে মেসেজ করুন"
        title="হোয়াটসঅ্যাপ"
        className="w-12 h-12 rounded-full bg-green-500 text-white shadow-lg flex items-center justify-center hover:bg-green-600 transition"
      >
        <MessageCircle size={22} />
      </a>
      <a
        href={`tel:${telNumber}`}
        aria-label="ফোন করুন"
        title="ফোন করুন"
        className="w-12 h-12 rounded-full bg-brass text-ink-900 shadow-lg flex items-center justify-center hover:opacity-90 transition"
      >
        <Phone size={20} />
      </a>
    </div>
  )
}
