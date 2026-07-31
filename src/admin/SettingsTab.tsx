import { useEffect, useState } from 'react'
import {
  Palette,
  History,
  DatabaseBackup,
  ShieldCheck,
  Download,
  RotateCcw,
  Trash2,
  AlertTriangle,
  RefreshCw,
  BarChart3,
} from 'lucide-react'
import { supabase, ActivityLog, logActivity } from '../lib/supabase'
import { applyTheme, DEFAULT_THEME } from '../lib/theme'
import { useSiteSettings } from '../lib/ThemeContext'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'

type SubTab = 'theme' | 'activity' | 'backup' | 'retention' | 'analytics'

export default function SettingsTab() {
  const [subTab, setSubTab] = useState<SubTab>('theme')

  const subTabs: { id: SubTab; label: string; icon: any }[] = [
    { id: 'theme', label: 'থিম কাস্টমাইজেশন', icon: Palette },
    { id: 'analytics', label: 'অ্যানালিটিক্স/পিক্সেল', icon: BarChart3 },
    { id: 'activity', label: 'অ্যাক্টিভিটি লগ', icon: History },
    { id: 'backup', label: 'ডাটাবেস ব্যাকআপ', icon: DatabaseBackup },
    { id: 'retention', label: 'ডেটা রিটেনশন', icon: ShieldCheck },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-lg shadow inline-flex flex-wrap">
        {subTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              subTab === id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {subTab === 'theme' && <ThemePanel />}
      {subTab === 'analytics' && <AnalyticsPanel />}
      {subTab === 'activity' && <ActivityLogPanel />}
      {subTab === 'backup' && <BackupPanel />}
      {subTab === 'retention' && <RetentionPanel />}
    </div>
  )
}

/* ========================================================================
   ০. অ্যানালিটিক্স/পিক্সেল ইন্টিগ্রেশন — GA4 ও Facebook Pixel ID সেট করা
   ======================================================================== */
function AnalyticsPanel() {
  const { settings, refreshSettings } = useSiteSettings()
  const [gaId, setGaId] = useState('')
  const [fbId, setFbId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (settings) {
      setGaId(settings.ga_measurement_id || '')
      setFbId(settings.fb_pixel_id || '')
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const { error: updateError } = await supabase
        .from('site_settings')
        .update({
          ga_measurement_id: gaId.trim() || null,
          fb_pixel_id: fbId.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', 1)

      if (updateError) throw updateError
      await logActivity('অ্যানালিটিক্স আইডি আপডেট করা হয়েছে', 'analytics', 'GA4/Facebook Pixel')
      await refreshSettings()
      setSaved(true)
    } catch (err) {
      console.error('অ্যানালিটিক্স সেভ ত্রুটি:', err)
      setError('সেভ করা যায়নি। আবার চেষ্টা করুন।')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
      <h2 className="text-lg font-bold text-gray-900 mb-1">অ্যানালিটিক্স/পিক্সেল ইন্টিগ্রেশন</h2>
      <p className="text-sm text-gray-500 mb-6">
        এখানে আইডি বসিয়ে সেভ করলেই সাইটে অটোমেটিক্যালি ট্র্যাকিং কোড চালু হয়ে যাবে — কোনো কোড এডিট বা রিডিপ্লয় লাগবে না।
      </p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {saved && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          সেভ হয়ে গেছে — সাইটে এখন থেকে ট্র্যাকিং চালু।
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Google Analytics 4 — Measurement ID</label>
        <input
          type="text"
          value={gaId}
          onChange={(e) => setGaId(e.target.value)}
          placeholder="G-XXXXXXXXXX"
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Google Analytics-এ Admin → Data Streams → ওয়েব স্ট্রিম খুললে এই ID পাবেন (G- দিয়ে শুরু)।
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Facebook Pixel ID</label>
        <input
          type="text"
          value={fbId}
          onChange={(e) => setFbId(e.target.value)}
          placeholder="123456789012345"
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p className="text-xs text-gray-400 mt-1">Meta Events Manager থেকে পিক্সেল আইডি (শুধু সংখ্যা) কপি করে বসান।</p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
      >
        {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
      </button>
    </div>
  )
}

/* ========================================================================
   ১. লাইভ থিম ও কালার কাস্টমাইজেশন প্যানেল
   ======================================================================== */
function ThemePanel() {
  const { settings, refreshSettings } = useSiteSettings()
  const [siteName, setSiteName] = useState('')
  const [primary, setPrimary] = useState(DEFAULT_THEME.color_primary)
  const [secondary, setSecondary] = useState(DEFAULT_THEME.color_secondary)
  const [accent, setAccent] = useState(DEFAULT_THEME.color_accent)
  const [background, setBackground] = useState(DEFAULT_THEME.color_background)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notReady, setNotReady] = useState(false)

  useEffect(() => {
    if (settings) {
      setSiteName(settings.site_name)
      setPrimary(settings.color_primary)
      setSecondary(settings.color_secondary)
      setAccent(settings.color_accent)
      setBackground(settings.color_background)
    }
  }, [settings])

  // কালার পরিবর্তন হওয়ামাত্র লাইভ প্রিভিউ প্রয়োগ করি (এখনো সেভ হয়নি)
  useEffect(() => {
    applyTheme({ color_primary: primary, color_secondary: secondary, color_accent: accent, color_background: background })
  }, [primary, secondary, accent, background])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('site_settings')
        .update({
          site_name: siteName.trim() || 'সার্ভিস মার্কেটপ্লেস',
          color_primary: primary,
          color_secondary: secondary,
          color_accent: accent,
          color_background: background,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', 1)

      if (updateError) throw updateError
      await logActivity('থিম কালার আপডেট করা হয়েছে', 'theme', siteName, {
        color_primary: primary,
        color_secondary: secondary,
        color_accent: accent,
        color_background: background,
      })
      await refreshSettings()
    } catch (err: any) {
      console.error('থিম সেভ ত্রুটি:', err)
      if (err?.code === '42P01' || /site_settings/.test(err?.message || '')) {
        setNotReady(true)
      } else {
        setError('থিম সেভ করা যায়নি। আবার চেষ্টা করুন।')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setPrimary(DEFAULT_THEME.color_primary)
    setSecondary(DEFAULT_THEME.color_secondary)
    setAccent(DEFAULT_THEME.color_accent)
    setBackground(DEFAULT_THEME.color_background)
  }

  const colorFields: { label: string; value: string; setter: (v: string) => void; hint: string }[] = [
    { label: 'প্রাইমারি কালার (মূল ব্র্যান্ড রঙ)', value: primary, setter: setPrimary, hint: 'বাটন, হেডার, লোগো এলিমেন্ট' },
    { label: 'সেকেন্ডারি কালার (সিল/অ্যাকসেন্ট)', value: secondary, setter: setSecondary, hint: 'ব্যাজ, সতর্কতা, হাইলাইট' },
    { label: 'অ্যাকসেন্ট কালার (ব্রাস/গোল্ড)', value: accent, setter: setAccent, hint: 'তারকা, প্রিমিয়াম উপাদান' },
    { label: 'ব্যাকগ্রাউন্ড কালার', value: background, setter: setBackground, hint: 'সাইটের মূল পেজ ব্যাকগ্রাউন্ড' },
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1">লাইভ থিম ও কালার কাস্টমাইজেশন</h2>
      <p className="text-sm text-gray-500 mb-6">
        রঙ পরিবর্তন করলেই নিচে সাথে সাথে প্রিভিউ দেখতে পাবেন। "সেভ করুন" চাপলে পুরো সাইটে (পাবলিক পেজসহ) লাইভ প্রয়োগ হয়ে যাবে —
        কোনো রিবিল্ড বা রিডিপ্লয় লাগবে না।
      </p>

      {notReady && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>site_settings টেবিল এখনো তৈরি হয়নি।</strong> প্রজেক্টের রুটে থাকা{' '}
          <code className="bg-amber-100 px-1 rounded">supabase_phase4_migration.sql</code> ফাইলটি Supabase Dashboard →
          SQL Editor-এ পেস্ট করে Run করুন, তারপর পেজ রিফ্রেশ করুন।
        </div>
      )}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">সাইটের নাম</label>
        <input
          type="text"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        {colorFields.map((f) => (
          <div key={f.label}>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{f.label}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{f.hint}</p>
          </div>
        ))}
      </div>

      {/* লাইভ প্রিভিউ */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-2">লাইভ প্রিভিউ</p>
        <div className="rounded-xl border border-gray-200 p-5" style={{ backgroundColor: background }}>
          <div className="flex items-center justify-between mb-4">
            <span className="font-display text-lg font-bold" style={{ color: primary }}>
              {siteName || 'সার্ভিস মার্কেটপ্লেস'}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: secondary }}>
              নতুন
            </span>
          </div>
          <button
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold mr-3"
            style={{ backgroundColor: primary }}
          >
            অর্ডার করুন
          </button>
          <button
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ backgroundColor: accent }}
          >
            বিস্তারিত দেখুন
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'সেভ হচ্ছে...' : 'পুরো সাইটে সেভ ও প্রয়োগ করুন'}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RotateCcw size={16} />
          ডিফল্ট থিমে ফিরে যান
        </button>
      </div>
    </div>
  )
}

/* ========================================================================
   ২. অ্যাডমিন অ্যাক্টিভিটি লগ
   ======================================================================== */
function ActivityLogPanel() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (fetchError) throw fetchError
      setLogs(data || [])
    } catch (err: any) {
      console.error('অ্যাক্টিভিটি লগ লোড ত্রুটি:', err)
      setError('অ্যাক্টিভিটি লগ লোড করা যায়নি। সম্ভবত supabase_phase4_migration.sql এখনো রান করা হয়নি।')
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = actionFilter
    ? logs.filter((l) => l.entity_type === actionFilter)
    : logs

  const entityTypes = Array.from(new Set(logs.map((l) => l.entity_type).filter(Boolean))) as string[]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">অ্যাডমিন অ্যাক্টিভিটি লগ</h2>
          <p className="text-sm text-gray-500">সাম্প্রতিক ২০০টি গুরুত্বপূর্ণ অ্যাকশনের অডিট ট্রেইল</p>
        </div>
        <div className="flex items-center gap-2">
          {entityTypes.length > 0 && (
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">সব ধরনের অ্যাকশন</option>
              {entityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={15} />
            রিফ্রেশ
          </button>
        </div>
      </div>

      {error && <div className="my-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-center py-10 text-gray-500">লোড করছি...</div>
      ) : filteredLogs.length === 0 && !error ? (
        <div className="text-center py-10 text-gray-400">এখনো কোনো অ্যাক্টিভিটি লগ নেই</div>
      ) : (
        <div className="mt-4 divide-y divide-gray-100">
          {filteredLogs.map((log) => (
            <div key={log.id} className="py-3 flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-semibold">{log.actor_name || 'অজানা ইউজার'}</span> — {log.action}
                  {log.entity_label && <span className="text-gray-500"> ({log.entity_label})</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDistanceToNow(new Date(log.created_at), { locale: bn, addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========================================================================
   ৩. অটোমেটেড ডাটাবেস ব্যাকআপ
   ======================================================================== */
function BackupPanel() {
  const { settings, refreshSettings } = useSiteSettings()
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const handleBackupNow = async () => {
    setExporting(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('export_full_backup')
      if (rpcError) throw rpcError

      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      await logActivity('ডাটাবেস ব্যাকআপ ডাউনলোড করা হয়েছে', 'system', 'backup')
      await refreshSettings()
    } catch (err: any) {
      console.error('ব্যাকআপ ত্রুটি:', err)
      setError('ব্যাকআপ নেওয়া যায়নি। supabase_phase4_migration.sql রান করা আছে কিনা যাচাই করুন।')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">এখনই ব্যাকআপ নিন</h2>
        <p className="text-sm text-gray-500 mb-4">
          এক ক্লিকে profiles, services, orders, coupons, gallery, reviews, cash-book ও সাইট সেটিংসের একটি সম্পূর্ণ JSON
          ব্যাকআপ ডাউনলোড হবে। এই ফাইল নিরাপদে আপনার কম্পিউটার বা Google Drive-এ রেখে দিন।
        </p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <button
          onClick={handleBackupNow}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
        >
          <Download size={16} />
          {exporting ? 'ব্যাকআপ তৈরি হচ্ছে...' : 'এখনই ব্যাকআপ ডাউনলোড করুন'}
        </button>

        {settings?.last_backup_at && (
          <p className="text-xs text-gray-400 mt-3">
            সর্বশেষ ব্যাকআপ: {formatDistanceToNow(new Date(settings.last_backup_at), { locale: bn, addSuffix: true })}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">সম্পূর্ণ অটোমেটেড শিডিউল (সার্ভার-সাইড)</h2>
        <p className="text-sm text-gray-500 mb-3">
          ব্রাউজার বন্ধ থাকলেও প্রতিদিন নিজে থেকে ব্যাকআপ নিতে হলে Supabase-এর <code className="bg-gray-100 px-1 rounded">pg_cron</code> এক্সটেনশন
          দরকার (সার্ভার-সাইড শিডিউলার, ফ্রন্টএন্ড কোড থেকে চালানো যায় না)। ধাপগুলো:
        </p>
        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1.5">
          <li>Supabase Dashboard → Database → Extensions → <code className="bg-gray-100 px-1 rounded">pg_cron</code> এনাবল করুন</li>
          <li>
            <code className="bg-gray-100 px-1 rounded">supabase_phase4_migration.sql</code> ফাইলের নিচের অংশে থাকা কমেন্ট করা{' '}
            <code className="bg-gray-100 px-1 rounded">cron.schedule(...)</code> কমান্ডটি আনকমেন্ট করে রান করুন
          </li>
          <li>Pro প্ল্যানে থাকলে Dashboard → Database → Backups-এ Point-in-Time Recovery (PITR) অটোমেটিক চালু থাকে — এটি সবচেয়ে নির্ভরযোগ্য ফুল-ডাটাবেস ব্যাকআপ</li>
        </ol>
      </div>
    </div>
  )
}

/* ========================================================================
   ৪. ডেটা রিটেনশন পলিসি
   ======================================================================== */
function RetentionPanel() {
  const { settings, refreshSettings } = useSiteSettings()
  const [completedDays, setCompletedDays] = useState(365)
  const [cancelledDays, setCancelledDays] = useState(90)
  const [documentsDays, setDocumentsDays] = useState(180)
  const [autoPurge, setAutoPurge] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ documents_cleared: number; cancelled_deleted: number; completed_flagged: number } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [purging, setPurging] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (settings) {
      setCompletedDays(settings.retention_completed_days)
      setCancelledDays(settings.retention_cancelled_days)
      setDocumentsDays(settings.retention_documents_days)
      setAutoPurge(settings.auto_purge_enabled)
    }
  }, [settings])

  const handleSaveSettings = async () => {
    setSaving(true)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('site_settings')
        .update({
          retention_completed_days: completedDays,
          retention_cancelled_days: cancelledDays,
          retention_documents_days: documentsDays,
          auto_purge_enabled: autoPurge,
        })
        .eq('id', 1)
      if (updateError) throw updateError
      await logActivity('ডেটা রিটেনশন সেটিংস আপডেট করা হয়েছে', 'system', 'retention_settings', {
        completedDays,
        cancelledDays,
        documentsDays,
        autoPurge,
      })
      await refreshSettings()
    } catch (err: any) {
      console.error('রিটেনশন সেটিংস সেভ ত্রুটি:', err)
      setError('সেভ করা যায়নি। supabase_phase4_migration.sql রান করা আছে কিনা যাচাই করুন।')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    setPreviewing(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('cleanup_old_data', { p_dry_run: true })
      if (rpcError) throw rpcError
      setPreview(data)
    } catch (err: any) {
      console.error('প্রিভিউ ত্রুটি:', err)
      setError('প্রিভিউ লোড করা যায়নি।')
    } finally {
      setPreviewing(false)
    }
  }

  const handlePurgeNow = async () => {
    if (!preview) {
      alert('প্রথমে প্রিভিউ দেখুন')
      return
    }
    const confirmed = window.confirm(
      `${preview.cancelled_deleted}টি পুরনো বাতিল অর্ডার স্থায়ীভাবে মুছে যাবে এবং ${preview.documents_cleared}টি অর্ডারের ডকুমেন্ট রেফারেন্স সাফ হয়ে যাবে। এগিয়ে যেতে চান?`
    )
    if (!confirmed) return

    setPurging(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('cleanup_old_data', { p_dry_run: false })
      if (rpcError) throw rpcError
      setPreview(null)
      await refreshSettings()
      alert('ডেটা রিটেনশন পার্জ সম্পন্ন হয়েছে')
    } catch (err: any) {
      console.error('পার্জ ত্রুটি:', err)
      setError('পার্জ করা যায়নি।')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">ডেটা রিটেনশন পলিসি</h2>
        <p className="text-sm text-gray-500 mb-5">
          কতদিন পর পুরনো ডেটা মুছে ফেলা বা পরিষ্কার করা হবে তা এখানে নির্ধারণ করুন। এটি কাস্টমারের প্রাইভেসি রক্ষা ও
          স্টোরেজ খরচ কমাতে সাহায্য করে।
        </p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="grid sm:grid-cols-3 gap-5 mb-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">সম্পন্ন অর্ডারের ডকুমেন্ট (দিন)</label>
            <input
              type="number"
              min={1}
              value={documentsDays}
              onChange={(e) => setDocumentsDays(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">এর বেশি পুরনো হলে আপলোড করা ডকুমেন্ট রেফারেন্স সাফ হবে</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">বাতিল অর্ডার (দিন)</label>
            <input
              type="number"
              min={1}
              value={cancelledDays}
              onChange={(e) => setCancelledDays(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">এর বেশি পুরনো cancelled অর্ডার স্থায়ীভাবে মুছে যাবে</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">সম্পন্ন অর্ডার আর্কাইভ (দিন)</label>
            <input
              type="number"
              min={1}
              value={completedDays}
              onChange={(e) => setCompletedDays(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">শুধু গণনা/রিপোর্টের জন্য — আর্থিক রেকর্ড হওয়ায় অটো ডিলিট হয় না</p>
          </div>
        </div>

        <label className="flex items-center gap-2 mb-5 text-sm text-gray-700">
          <input type="checkbox" checked={autoPurge} onChange={(e) => setAutoPurge(e.target.checked)} className="rounded" />
          pg_cron শিডিউল করা থাকলে প্রতিদিন রাতে অটোমেটিক পার্জ চালু রাখুন
        </label>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'সেভ হচ্ছে...' : 'রিটেনশন সেটিংস সেভ করুন'}
        </button>

        {settings?.last_purge_at && (
          <p className="text-xs text-gray-400 mt-3">
            সর্বশেষ পার্জ: {formatDistanceToNow(new Date(settings.last_purge_at), { locale: bn, addSuffix: true })}
            {settings.last_purge_summary && (
              <>
                {' '}
                — {settings.last_purge_summary.cancelled_deleted}টি অর্ডার মুছা হয়েছে, {settings.last_purge_summary.documents_cleared}টি ডকুমেন্ট সাফ হয়েছে
              </>
            )}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">ম্যানুয়াল পার্জ (এখনই চালান)</h2>
            <p className="text-sm text-gray-500">প্রথমে প্রিভিউ দেখুন — কিছুই মুছে ফেলা হবে না, শুধু সংখ্যা দেখাবে</p>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {previewing ? 'লোড হচ্ছে...' : 'প্রিভিউ দেখুন'}
          </button>
          {preview && (
            <button
              onClick={handlePurgeNow}
              disabled={purging}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
            >
              <Trash2 size={16} />
              {purging ? 'পার্জ হচ্ছে...' : 'এখনই পার্জ চালান'}
            </button>
          )}
        </div>

        {preview && (
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-900">{preview.documents_cleared}</p>
              <p className="text-xs text-gray-500 mt-1">ডকুমেন্ট সাফ হবে</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-900">{preview.cancelled_deleted}</p>
              <p className="text-xs text-gray-500 mt-1">বাতিল অর্ডার মুছা হবে</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-900">{preview.completed_flagged}</p>
              <p className="text-xs text-gray-500 mt-1">পুরনো সম্পন্ন অর্ডার (শুধু তথ্য)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
