import { useEffect, useState } from 'react'
import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const DEFAULT_PHONE = '01968673241'
const DEFAULT_WHATSAPP = '8801968673241'
const DEFAULT_EMAIL = 'newprintssmj@gmail.com'
const DEFAULT_ADDRESS = 'সুন্দলপুর বাজার, ঈদগাহের পূর্ব পাশে, মনিরামপুর, যশোর'

export default function Contact() {
  const [phone, setPhone] = useState(DEFAULT_PHONE)
  const [whatsapp, setWhatsapp] = useState(DEFAULT_WHATSAPP)
  const [email, setEmail] = useState(DEFAULT_EMAIL)
  const [address, setAddress] = useState(DEFAULT_ADDRESS)
  const [mapEmbedUrl, setMapEmbedUrl] = useState('')

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('contact_phone, contact_whatsapp, contact_email, contact_address, contact_map_embed_url')
          .eq('id', 1)
          .maybeSingle()

        if (data?.contact_phone) setPhone(data.contact_phone)
        if (data?.contact_whatsapp) setWhatsapp(data.contact_whatsapp)
        if (data?.contact_email) setEmail(data.contact_email)
        if (data?.contact_address) setAddress(data.contact_address)
        if (data?.contact_map_embed_url) setMapEmbedUrl(data.contact_map_embed_url)
      } catch (error) {
        console.error('যোগাযোগ তথ্য লোড ত্রুটি:', error)
      }
    }
    fetchContact()
  }, [])

  const PHONE = phone
  const WHATSAPP_NUMBER = whatsapp
  const EMAIL = email
  const ADDRESS = address
  const mapSrc = mapEmbedUrl || `https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&output=embed`

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="font-stamp text-xs tracking-widest text-seal">যোগাযোগ করুন</span>
          <h2 className="font-display text-3xl font-bold text-ink-700 mt-2">আমাদের সাথে যোগাযোগ করুন</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          <div className="space-y-5">
            <a
              href={`tel:${PHONE}`}
              className="flex items-center gap-4 bg-paper border border-sage rounded-xl p-5 hover:border-brass hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center flex-shrink-0">
                <Phone className="text-ink-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-charcoal/60">ফোন করুন</p>
                <p className="font-stamp font-bold text-charcoal">{PHONE}</p>
              </div>
            </a>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-paper border border-sage rounded-xl p-5 hover:border-brass hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="text-ink-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-charcoal/60">হোয়াটসঅ্যাপ</p>
                <p className="font-stamp font-bold text-charcoal">{PHONE}</p>
              </div>
            </a>

            <a
              href={`mailto:${EMAIL}`}
              className="flex items-center gap-4 bg-paper border border-sage rounded-xl p-5 hover:border-brass hover:shadow-md transition"
            >
              <div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center flex-shrink-0">
                <Mail className="text-ink-600" size={20} />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm text-charcoal/60">ইমেইল</p>
                <p className="font-stamp font-bold text-charcoal truncate">{EMAIL}</p>
              </div>
            </a>

            <div className="flex items-start gap-4 bg-paper border border-sage rounded-xl p-5">
              <div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="text-ink-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-charcoal/60">ঠিকানা</p>
                <p className="font-medium text-charcoal">{ADDRESS}</p>
              </div>
            </div>
          </div>

          <div className="doc-frame rounded-xl overflow-hidden shadow-md min-h-[320px]">
            <iframe
              title="নিউ প্রিন্টার্স লোকেশন ম্যাপ"
              src={mapSrc}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: 320 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
