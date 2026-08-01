import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Megaphone, X } from 'lucide-react'

export default function SiteBanner() {
  const [banner, setBanner] = useState<{ text: string; link?: string | null } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('banner_enabled, banner_text, banner_link, notice_enabled, notice_text')
          .eq('id', 1)
          .maybeSingle()

        if (data?.banner_enabled && data.banner_text) {
          setBanner({ text: data.banner_text, link: data.banner_link })
        }
        if (data?.notice_enabled && data.notice_text) {
          setNotice(data.notice_text)
        }
      } catch (error) {
        console.error('ব্যানার/নোটিশ লোড ত্রুটি:', error)
      }
    }
    fetchSettings()
  }, [])

  if (dismissed || (!banner && !notice)) return null

  const bannerInner = (
    <div className="flex items-center gap-2 justify-center flex-1 min-w-0">
      <Megaphone size={15} className="flex-shrink-0" />
      <span className="truncate text-sm font-medium">{banner?.text}</span>
    </div>
  )

  return (
    <div>
      {banner && (
        <div className="bg-brass text-ink-900 px-4 py-2 flex items-center gap-3">
          {banner.link ? (
            <a href={banner.link} className="flex-1 min-w-0">
              {bannerInner}
            </a>
          ) : (
            bannerInner
          )}
          <button
            onClick={() => setDismissed(true)}
            aria-label="বন্ধ করুন"
            className="flex-shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="bg-ink-700 text-white px-4 py-2 flex items-center justify-center gap-2">
          <Megaphone size={15} className="flex-shrink-0" />
          <span className="truncate text-sm font-medium">{notice}</span>
        </div>
      )}
    </div>
  )
}
