import { useMemo, useState } from 'react'
import { Award, Download, Printer } from 'lucide-react'
import { supabase, logActivity, StudentOverview } from '../../lib/supabase'
import { downloadCsv } from '../reports/reportUtils'
import { printCertificate } from './certificatePrint'

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')

/** সার্টিফিকেট ইস্যু/প্রিন্ট ও Course Completion Record */
export default function CertificatePanel({ students, reload }: { students: StudentOverview[]; reload: () => void }) {
  const [tab, setTab] = useState<'pending' | 'issued'>('pending')
  const [results, setResults] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const pending = useMemo(() => students.filter((s) => !s.certificate_no && s.training_status !== 'dropped'), [students])
  const issued = useMemo(() => students.filter((s) => s.certificate_no), [students])
  const attPct = (s: StudentOverview) => (s.total_classes ? Math.round(((s.present_count + s.late_count) / s.total_classes) * 100) : null)

  const issue = async (s: StudentOverview) => {
    const warns: string[] = []
    if (s.due > 0) warns.push(`ফি বাকি আছে (${taka(s.due)})`)
    const p = attPct(s)
    if (p !== null && p < 75) warns.push(`হাজিরা মাত্র ${p}%`)
    if (warns.length && !window.confirm(`⚠️ ${warns.join(' এবং ')}।\nতবুও সার্টিফিকেট দেবেন?`)) return
    setBusyId(s.id)
    const { data, error } = await supabase.rpc('issue_certificate', { p_enrollment_id: s.id, p_result: results[s.id] || null })
    setBusyId(null)
    if (error || !data?.success) {
      alert(data?.message || 'সার্টিফিকেট ইস্যু করা যায়নি')
      if (error) console.error('সার্টিফিকেট ত্রুটি:', error)
      return
    }
    logActivity('সার্টিফিকেট ইস্যু', 'certificate', s.full_name, { no: data.certificate_no })
    printCertificate({ ...s, certificate_no: data.certificate_no, certificate_date: data.issue_date }, data.result)
    reload()
  }

  const exportRecord = () =>
    downloadCsv('course-completion-record.csv', [
      ['সনদ নং', 'নাম', 'ফোন', 'কোর্স', 'ব্যাচ', 'শুরু', 'সনদের তারিখ', 'হাজিরা %', 'মোট ফি', 'পেইড', 'বাকি'],
      ...issued.map((s) => [s.certificate_no || '', s.full_name, s.phone, s.course_title, s.batch_name || '', s.start_date || '', s.certificate_date || '', attPct(s) ?? '', s.net_fee, s.paid, s.due]),
    ])

  const list = tab === 'pending' ? pending : issued

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([['pending', `ইস্যু বাকি (${pending.length})`], ['issued', `ইস্যু হয়েছে (${issued.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded text-sm border ${tab === id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
        <button onClick={exportRecord} disabled={issued.length === 0} className="ml-auto flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 disabled:opacity-40">
          <Download size={16} /> Completion Record (CSV)
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-center text-gray-500 py-8 text-sm">{tab === 'pending' ? 'ইস্যু করার মতো কেউ নেই' : 'এখনো কোনো সার্টিফিকেট ইস্যু হয়নি'}</p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {list.map((s) => {
            const p = attPct(s)
            return (
              <div key={s.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{s.full_name} <span className="text-xs text-gray-500 font-normal">• {s.phone}</span></p>
                  <p className="text-xs text-gray-500">
                    {s.course_title}{s.batch_name ? ` • ${s.batch_name}` : ''} • হাজিরা {p === null ? '—' : `${p}%`} •{' '}
                    <span className={s.due > 0 ? 'text-red-600 font-semibold' : 'text-green-700'}>{s.due > 0 ? `বাকি ${taka(s.due)}` : 'ফি পরিশোধিত'}</span>
                  </p>
                  {s.certificate_no && <p className="text-xs text-indigo-700 mt-0.5">সনদ নং {s.certificate_no}</p>}
                </div>
                {tab === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <input value={results[s.id] || ''} onChange={(e) => setResults({ ...results, [s.id]: e.target.value })} placeholder="ফলাফল (A+, ঐচ্ছিক)" className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
                    <button onClick={() => issue(s)} disabled={busyId === s.id} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 disabled:opacity-50">
                      <Award size={15} /> {busyId === s.id ? '...' : 'ইস্যু ও প্রিন্ট'}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => printCertificate(s)} className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50">
                    <Printer size={15} /> আবার প্রিন্ট
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="text-xs text-gray-400">* “আবার প্রিন্ট”-এ ইস্যুর সময় দেওয়া ফলাফল (A+ ইত্যাদি) সনদে আসবে না — প্রথম প্রিন্টেই সেটা থাকে।</p>
    </div>
  )
}
