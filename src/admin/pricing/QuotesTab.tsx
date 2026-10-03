import { useCallback, useEffect, useState } from 'react'
import { supabase, ShopCustomer } from '../../lib/supabase'
import { canDo } from '../../lib/permissions'
import { PriceRule, QuoteItemRow, QuoteRow } from './pricingUtils'
import QuoteBuilder from './QuoteBuilder'
import QuoteList from './QuoteList'
import RateManager from './RateManager'

/** POS-এ পাঠানো কোটেশনের তথ্য (localStorage-এ রেখে POS ট্যাবে নেওয়া হয়) */
export const PENDING_QUOTE_KEY = 'np_pending_quote'

/** প্রাইস ও কোটেশন */
export default function QuotesTab({ role, onGo }: { role?: string; onGo: (tab: string) => void }) {
  const isAdmin = canDo(role, 'quote.sell')
  const canEditRates = canDo(role, 'pricing.edit')
  const [view, setView] = useState<'build' | 'list' | 'rates'>('build')
  const [rules, setRules] = useState<PriceRule[]>([])
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  const loadRules = useCallback(async () => {
    const { data, error: e } = await supabase.from('price_rules').select('*').order('sort_order')
    if (e) { console.error('রেট লোড ত্রুটি:', e); setError('রেট লোড করা যায়নি (ফেজ I-এর SQL রান করা আছে কি?)') } else setError('')
    setRules(((data as PriceRule[]) || []).map((r) => ({ ...r, tiers: Array.isArray(r.tiers) ? r.tiers : [] })))
  }, [])
  useEffect(() => { loadRules() }, [loadRules])

  const sell = (q: QuoteRow, items: QuoteItemRow[], customer: ShopCustomer | null) => {
    try {
      localStorage.setItem(PENDING_QUOTE_KEY, JSON.stringify({ quoteId: q.id, quoteNo: q.quote_no, discount: q.discount, customer, lines: items.map((i) => ({ name: i.detail ? `${i.description} (${i.detail})` : i.description, quantity: i.quantity, unit_price: i.unit_price })) }))
    } catch { return alert('ব্রাউজার স্টোরেজ বন্ধ — POS-এ পাঠানো যাচ্ছে না') }
    onGo('pos')
  }

  const tabs: { id: typeof view; label: string }[] = [{ id: 'build', label: 'ক্যালকুলেটর ও নতুন কোটেশন' }, { id: 'list', label: 'কোটেশন তালিকা' }, ...(canEditRates ? [{ id: 'rates' as const, label: 'রেট ম্যানেজমেন্ট' }] : [])]
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => <button key={t.id} onClick={() => setView(t.id)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${view === t.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 shadow hover:bg-gray-50'}`}>{t.label}</button>)}
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
      <div className="bg-white rounded-lg shadow p-6">
        {view === 'build' && <QuoteBuilder rules={rules} onSaved={() => setRefresh((n) => n + 1)} />}
        {view === 'list' && <QuoteList isAdmin={isAdmin} onSell={sell} refreshKey={refresh} />}
        {view === 'rates' && canEditRates && <RateManager rules={rules} reload={loadRules} />}
      </div>
    </div>
  )
}
