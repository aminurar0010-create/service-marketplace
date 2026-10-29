import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, Service, ServiceRequiredDocument } from '../lib/supabase'
import { getServiceEmoji } from '../lib/serviceEmoji'
import ServiceCard from '../components/ServiceCard'
import { useSEO } from '../lib/useSEO'
import { ArrowLeft, Clock, FileText, Wallet } from 'lucide-react'

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [service, setService] = useState<Service | null>(null)
  const [requiredDocs, setRequiredDocs] = useState<ServiceRequiredDocument[]>([])
  const [relatedServices, setRelatedServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // দাম ০ মানে নির্ধারিত নয় — সার্চ বিবরণে "মূল্য ৳০" লেখা হয় না
  const hasPrice = !!service && Number(service.price) > 0
  useSEO(
    service ? `${service.name} — মনিরামপুর, যশোর | নিউ প্রিন্টার্স` : undefined,
    service
      ? `${service.name} — সুন্দলপুর বাজার, মনিরামপুর, যশোর থেকে অর্ডার করুন।${hasPrice ? ` মূল্য ৳${service.price}।` : ''} ${(service.description || '').slice(0, 100)}`.trim()
      : undefined,
    service
      ? {
          image: service.image_url || null,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: service.name,
            description: service.description || undefined,
            category: service.category || undefined,
            image: service.image_url || undefined,
            areaServed: 'মনিরামপুর, যশোর',
            provider: { '@type': 'Store', name: 'নিউ প্রিন্টার্স (New Printers)' },
            offers: hasPrice ? { '@type': 'Offer', price: Number(service.price), priceCurrency: 'BDT' } : undefined,
          },
        }
      : undefined
  )

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const { data: svc } = await supabase
          .from('services')
          .select('*')
          .eq('id', id)
          .eq('is_active', true)
          .maybeSingle()

        if (!svc) {
          setNotFound(true)
          return
        }
        setService(svc)

        const [{ data: docs }, { data: related }] = await Promise.all([
          supabase
            .from('service_required_documents')
            .select('*')
            .eq('service_id', svc.id)
            .order('display_order', { ascending: true }),
          supabase
            .from('services')
            .select('*')
            .eq('category', svc.category)
            .eq('is_active', true)
            .neq('id', svc.id)
            .limit(9),
        ])

        setRequiredDocs(docs || [])
        setRelatedServices(related || [])
      } catch (error) {
        console.error('সার্ভিস লোড ত্রুটি:', error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
    window.scrollTo(0, 0)
  }, [id])

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-charcoal/50">লোড করছি...</div>
  }

  if (notFound || !service) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
        <p className="text-charcoal/60 mb-4">এই সেবাটি খুঁজে পাওয়া যায়নি</p>
        <Link to="/" className="text-ink-600 font-semibold hover:underline">
          হোমে ফিরে যান
        </Link>
      </div>
    )
  }

  const formatHours = (h?: number | null) => (!h || h <= 0 ? null : h < 24 ? `${h} ঘণ্টা` : `${Math.round(h / 24)} দিন`)
  const normalTime = formatHours(service.estimated_hours)
  const urgentTime = formatHours(service.urgent_delivery_hours)
  const urgentFeeText =
    service.urgent_fee_type && Number(service.urgent_fee_value) > 0
      ? service.urgent_fee_type === 'percentage'
        ? `+${service.urgent_fee_value}%`
        : `+৳${service.urgent_fee_value}`
      : null

  return (
    <div className="min-h-screen bg-paper px-4 py-10 sm:py-14">
      <div className="max-w-4xl mx-auto">
        <Link to="/#services" className="flex items-center gap-1.5 text-sm text-ink-600 hover:underline mb-6 font-semibold">
          <ArrowLeft size={16} />
          সব সেবা
        </Link>

        <div className="grid sm:grid-cols-5 gap-8">
          <div className="sm:col-span-2">
            <div className="aspect-square sm:aspect-[4/5] rounded-xl overflow-hidden doc-frame">
              {service.image_url ? (
                <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
              ) : (
                <div className="bg-gradient-to-br from-ink-600 to-ink-700 w-full h-full flex items-center justify-center text-7xl">
                  {getServiceEmoji(service.name)}
                </div>
              )}
            </div>
          </div>

          <div className="sm:col-span-3">
            <span className="font-stamp text-xs tracking-widest text-seal">{service.category}</span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-700 mt-1.5 mb-3">{service.name}</h1>

            {/* এক নজরে: খরচ / সময় / ডকুমেন্ট */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6" data-testid="service-at-a-glance">
              <div className="bg-white rounded-lg border border-ink-50 p-3">
                <p className="flex items-center gap-1.5 text-xs text-charcoal/50 mb-1">
                  <Wallet size={14} className="text-brass" /> খরচ
                </p>
                {hasPrice ? (
                  <p className="font-stamp text-2xl font-bold text-ink-600">৳{service.price}</p>
                ) : (
                  <p className="text-sm font-semibold text-ink-600 leading-snug">দাম জানতে যোগাযোগ করুন</p>
                )}
                {urgentFeeText && <p className="text-xs text-orange-600 mt-1">জরুরি হলে {urgentFeeText}</p>}
              </div>

              {normalTime && (
                <div className="bg-white rounded-lg border border-ink-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-charcoal/50 mb-1">
                    <Clock size={14} className="text-brass" /> সময়
                  </p>
                  <p className="text-sm font-semibold text-ink-600">প্রায় {normalTime}</p>
                  {urgentTime && urgentFeeText && <p className="text-xs text-orange-600 mt-1">জরুরিতে {urgentTime}</p>}
                </div>
              )}

              {requiredDocs.length > 0 && (
                <div className="bg-white rounded-lg border border-ink-50 p-3 col-span-2 sm:col-span-1">
                  <p className="flex items-center gap-1.5 text-xs text-charcoal/50 mb-1">
                    <FileText size={14} className="text-brass" /> ডকুমেন্ট
                  </p>
                  <p className="text-sm font-semibold text-ink-600">{requiredDocs.length}টি লাগবে</p>
                  <p className="text-xs text-charcoal/50 mt-1">নিচে তালিকা দেখুন</p>
                </div>
              )}
            </div>

            {service.description && (
              <p className="text-charcoal/70 leading-relaxed whitespace-pre-line mb-6">{service.description}</p>
            )}

            {requiredDocs.length > 0 && (
              <div className="bg-white rounded-lg p-4 mb-6 border border-ink-50">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-charcoal mb-2">
                  <FileText size={15} className="text-brass" /> যা যা লাগবে
                </p>
                <ul className="space-y-1">
                  {requiredDocs.map((doc) => (
                    <li key={doc.id} className="text-sm text-charcoal/70 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sage flex-shrink-0" />
                      {doc.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              to={`/order?service=${service.id}`}
              className="inline-block w-full sm:w-auto text-center bg-ink-600 text-white px-8 py-3 rounded-lg hover:bg-ink-700 transition font-semibold"
            >
              অর্ডার করুন
            </Link>
          </div>
        </div>

        {relatedServices.length > 0 && (
          <div className="mt-16 pt-10 border-t border-ink-50">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-700 mb-6">
              {service.category} থেকে আরও সেবা
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-6">
              {relatedServices.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
