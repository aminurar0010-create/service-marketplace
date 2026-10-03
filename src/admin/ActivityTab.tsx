import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Download, LogIn, RefreshCw } from 'lucide-react'
import { supabase, ActivityLog } from '../lib/supabase'
import { TAB_ACCESS, ACTION_ACCESS } from '../lib/permissions'
import { rangeDates, rangeIso, RangeKey, RANGE_LABELS, fetchAll, downloadCsv } from './reports/reportUtils'

const TAB_LABELS: Record<string, string> = {
  today: 'আজকের কাজ', orders: 'অর্ডার', customer_ledger: 'কাস্টমার খাতা', cashbook: 'ক্যাশ-বুক',
  pos: 'POS', due_collection: 'বাকি আদায়', reports: 'রিপোর্টস', inventory: 'ইনভেন্টরি', training: 'Students & Training',
  enrollments: 'Student Enrollments', courses: 'Courses', services: 'সার্ভিস', users: 'ইউজার', settings: 'সেটিংস', activity: 'লগ ও নিরাপত্তা',
}
const ACTION_LABELS: Record<string, string> = {
  'cashbook.add': 'ক্যাশ-বুকে নতুন এন্ট্রি', 'cashbook.delete': 'ক্যাশ-বুকের এন্ট্রি মোছা', 'activitylog.view': 'অ্যাক্টিভিটি লগ দেখা',
}
const ROLE_LABELS: Record<string, string> = { admin: 'অ্যাডমিন', counter_operator: 'কাউন্টার অপারেটর' }

/** লগ ও নিরাপত্তা — স্টাফ-ভিত্তিক অ্যাক্টিভিটি, লগইন লগ ও Permission ম্যাট্রিক্স (শুধু অ্যাডমিন) */
export default function ActivityTab() {
  const [range, setRange] = useState<RangeKey>('week')
  const [staff, setStaff] = useState('all')
  const [kind, setKind] = useState<'all' | 'login'>('all')
  const [search, setSearch] = useState('')
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { from, to } = rangeDates(range)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { start, end } = rangeIso(from, to)
    try {
      const data = await fetchAll<ActivityLog>((a, b) =>
        supabase.from('activity_logs').select('*').gte('created_at', start).lt('created_at', end).order('created_at', { ascending: false }).range(a, b)
      )
      setLogs(data)
    } catch (e) {
      console.error('অ্যাক্টিভিটি লগ ত্রুটি:', e)
      setError('লগ লোড করা যায়নি (শুধু অ্যাডমিন দেখতে পারেন)')
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const staffNames = useMemo(() => [...new Set(logs.map((l) => l.actor_name || 'অজানা'))].sort(), [logs])
  const shown = logs.filter(
    (l) =>
      (staff === 'all' || (l.actor_name || 'অজানা') === staff) &&
      (kind === 'all' || l.entity_type === 'auth') &&
      (!search.trim() || `${l.action} ${l.entity_label || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  )
  const perStaff = useMemo(() => {
    const m = new Map<string, { total: number; logins: number }>()
    logs.forEach((l) => {
      const k = l.actor_name || 'অজানা'
      const v = m.get(k) || { total: 0, logins: 0 }
      v.total += 1
      if (l.entity_type === 'auth') v.logins += 1
      m.set(k, v)
    })
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [logs])

  const exportCsv = () =>
    downloadCsv(`activity-${from}_${to}.csv`, [
      ['সময়', 'স্টাফ', 'কাজ', 'বিষয়', 'ধরন'],
      ...shown.map((l) => [format(new Date(l.created_at), 'yyyy-MM-dd HH:mm'), l.actor_name || 'অজানা', l.action, l.entity_label || '', l.entity_type || '']),
    ])

  const pill = (active: boolean) => `px-3 py-1.5 rounded text-sm border transition ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`
  const roles = ['admin', 'counter_operator'] as const
  const tabIds = Object.keys(TAB_ACCESS).filter((t) => TAB_LABELS[t])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <button key={k} onClick={() => setRange(k)} className={pill(range === k)}>{RANGE_LABELS[k]}</button>
          ))}
          <select value={staff} onChange={(e) => setStaff(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none">
            <option value="all">সব স্টাফ</option>
            {staffNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button onClick={() => setKind(kind === 'login' ? 'all' : 'login')} className={`${pill(kind === 'login')} flex items-center gap-1`}>
            <LogIn size={14} /> শুধু লগইন
          </button>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="কাজ/বিষয় খুঁজুন" className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none" />
          <button onClick={load} className="p-1.5 text-gray-500 hover:text-indigo-600" title="রিফ্রেশ"><RefreshCw size={16} /></button>
          <button onClick={exportCsv} disabled={shown.length === 0} className="ml-auto flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 disabled:opacity-40">
            <Download size={16} /> CSV
          </button>
        </div>

        {perStaff.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {perStaff.map(([name, v]) => (
              <span key={name} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {name}: <b>{v.total}</b> কাজ{v.logins > 0 && <span className="text-gray-500"> • {v.logins} লগইন</span>}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-500 py-8 text-sm">লোড করছি...</p>
        ) : error ? (
          <p className="text-center text-red-600 py-8 text-sm">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">এই সময়ে কোনো লগ নেই</p>
        ) : (
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">সময়</th>
                  <th className="px-3 py-2 text-left">স্টাফ</th>
                  <th className="px-3 py-2 text-left">কাজ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{format(new Date(l.created_at), 'dd/MM hh:mm a')}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{l.actor_name || 'অজানা'}</td>
                    <td className="px-3 py-2">
                      {l.action}
                      {l.entity_label && <span className="text-gray-500"> — {l.entity_label}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-400">* {from} থেকে {to}। লগ বন্ধ করা বা মুছে ফেলা শুধু অ্যাডমিন (সেটিংস → অ্যাক্টিভিটি লগ) পারেন।</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold mb-1">Permission ম্যাট্রিক্স (কে কী করতে পারে)</h3>
        <p className="text-xs text-gray-500 mb-3">বদলাতে চাইলে বলুন — কোড ও ডাটাবেস (RLS) দুটোই একসাথে বদলাতে হয়। স্টাফ রোল আলাদা স্টাফ-ড্যাশবোর্ড ব্যবহার করে।</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">ট্যাব / কাজ</th>
                {roles.map((r) => (
                  <th key={r} className="px-3 py-2 text-center">{ROLE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabIds.map((t) => (
                <tr key={t} className="border-b border-gray-100">
                  <td className="px-3 py-1.5">{TAB_LABELS[t]} <span className="text-xs text-gray-400">(ট্যাব)</span></td>
                  {roles.map((r) => (
                    <td key={r} className="px-3 py-1.5 text-center">{TAB_ACCESS[t].includes(r) ? '✅' : '—'}</td>
                  ))}
                </tr>
              ))}
              {Object.keys(ACTION_ACCESS).map((a) => (
                <tr key={a} className="border-b border-gray-100 bg-amber-50/40">
                  <td className="px-3 py-1.5">{ACTION_LABELS[a] || a} <span className="text-xs text-gray-400">(কাজ)</span></td>
                  {roles.map((r) => (
                    <td key={r} className="px-3 py-1.5 text-center">{ACTION_ACCESS[a].includes(r) ? '✅' : '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
