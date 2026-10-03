import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Loader2, Stethoscope } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Check {
  key: string
  label: string
  count: number
  hint?: string
}

/** সিস্টেম হেলথ চেক — বিক্রি → পেমেন্ট → ক্যাশ-বুক → কাস্টমার চেইনের গরমিল ধরে (শুধু পড়ে, কিছু বদলায় না) */
export default function HealthCheck() {
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true)
    setError('')
    const { data, error: e } = await supabase.rpc('workflow_health')
    setLoading(false)
    if (e || !data || data.error) {
      if (e) console.error('হেলথ চেক ত্রুটি:', e)
      setError(data?.error || 'চেক চালানো যায়নি (ফেজ H-এর SQL রান করা আছে কি?)')
      return
    }
    setChecks(data.checks as Check[])
  }

  const problems = checks?.filter((c) => c.count > 0) || []

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h3 className="font-bold flex items-center gap-2"><Stethoscope size={18} className="text-indigo-600" /> সিস্টেম হেলথ চেক</h3>
        <button onClick={run} disabled={loading} className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />} {checks ? 'আবার চেক করুন' : 'চেক চালান'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">বিক্রি, পেমেন্ট, ক্যাশ-বুক, কাস্টমার ও স্টকের হিসাব একে অপরের সাথে মেলে কিনা দেখে। কিছু বদলায় না।</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {checks && (
        <>
          <p className={`text-sm font-semibold mb-3 ${problems.length ? 'text-amber-700' : 'text-green-700'}`}>
            {problems.length ? `${problems.length}টি বিষয় দেখা দরকার` : 'সব হিসাব মিলছে ✅'}
          </p>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {checks.map((c) => (
              <li key={c.key} className="px-3 py-2 flex items-start gap-3 text-sm">
                {c.count > 0 ? <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={c.count > 0 ? 'font-semibold text-gray-800' : 'text-gray-600'}>
                    {c.label}
                    {c.count > 0 && <span className="ml-2 text-amber-700">{c.count.toLocaleString('bn-BD')}</span>}
                  </p>
                  {c.count > 0 && c.hint && <p className="text-xs text-gray-500">{c.hint}</p>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
