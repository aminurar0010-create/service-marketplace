import { useEffect, useState } from 'react'
import { supabase, SiteSettings, logActivity } from '../lib/supabase'
import { Globe, Save, Loader2, CheckCircle2 } from 'lucide-react'

export default function WebsiteTab() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      setSettings(data)
    } catch (error) {
      console.error('সেটিংস লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const update = (patch: Partial<SiteSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s))

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({
          banner_enabled: settings.banner_enabled,
          banner_text: settings.banner_text,
          banner_link: settings.banner_link,
          notice_enabled: settings.notice_enabled,
          notice_text: settings.notice_text,
          contact_phone: settings.contact_phone,
          contact_whatsapp: settings.contact_whatsapp,
          contact_email: settings.contact_email,
          contact_address: settings.contact_address,
          contact_facebook: settings.contact_facebook,
          contact_map_embed_url: settings.contact_map_embed_url,
        })
        .eq('id', 1)
      if (error) throw error
      logActivity('ওয়েবসাইট কন্টেন্ট আপডেট করা হয়েছে', 'site_settings')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('সেভ ত্রুটি:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) {
    return <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">লোড করছি...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex items-center gap-3">
        <Globe className="text-indigo-600" size={22} />
        <div>
          <h2 className="text-xl font-bold">ওয়েবসাইট ম্যানেজমেন্ট</h2>
          <p className="text-sm text-gray-500 mt-1">ব্যানার, নোটিশ ও যোগাযোগ তথ্য পরিবর্তন করুন</p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* ব্যানার */}
        <section>
          <h3 className="font-semibold text-gray-800 mb-3">সাইট-ওয়াইড ব্যানার</h3>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              checked={settings.banner_enabled || false}
              onChange={(e) => update({ banner_enabled: e.target.checked })}
              className="rounded border-gray-300"
            />
            ব্যানার সক্রিয় করুন
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ব্যানার টেক্সট</label>
              <input
                value={settings.banner_text || ''}
                onChange={(e) => update({ banner_text: e.target.value })}
                placeholder="যেমনঃ ঈদ উপলক্ষে ২০% ছাড়!"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ব্যানার লিংক (ঐচ্ছিক)</label>
              <input
                value={settings.banner_link || ''}
                onChange={(e) => update({ banner_link: e.target.value })}
                placeholder="/order"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </section>

        {/* নোটিশ */}
        <section className="pt-6 border-t border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">নোটিশ</h3>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              checked={settings.notice_enabled || false}
              onChange={(e) => update({ notice_enabled: e.target.checked })}
              className="rounded border-gray-300"
            />
            নোটিশ সক্রিয় করুন
          </label>
          <textarea
            value={settings.notice_text || ''}
            onChange={(e) => update({ notice_text: e.target.value })}
            placeholder="যেমনঃ শুক্রবার অফিস বন্ধ থাকবে"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </section>

        {/* যোগাযোগ */}
        <section className="pt-6 border-t border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">যোগাযোগের তথ্য</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ফোন নম্বর</label>
              <input
                value={settings.contact_phone || ''}
                onChange={(e) => update({ contact_phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">হোয়াটসঅ্যাপ নম্বর</label>
              <input
                value={settings.contact_whatsapp || ''}
                onChange={(e) => update({ contact_whatsapp: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ইমেইল</label>
              <input
                value={settings.contact_email || ''}
                onChange={(e) => update({ contact_email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ফেসবুক লিংক</label>
              <input
                value={settings.contact_facebook || ''}
                onChange={(e) => update({ contact_facebook: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">ঠিকানা</label>
              <input
                value={settings.contact_address || ''}
                onChange={(e) => update({ contact_address: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">গুগল ম্যাপ Embed URL</label>
              <input
                value={settings.contact_map_embed_url || ''}
                onChange={(e) => update({ contact_map_embed_url: e.target.value })}
                placeholder="https://www.google.com/maps/embed?..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="p-6 border-t border-gray-200 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          সংরক্ষণ করুন
        </button>
        {saved && (
          <p className="flex items-center gap-1.5 text-green-700 text-sm">
            <CheckCircle2 size={16} />
            সংরক্ষিত হয়েছে
          </p>
        )}
      </div>
    </div>
  )
}
