import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Printer, ShoppingCart, Trash2 } from 'lucide-react'
import { supabase, logActivity, ShopCustomer } from '../../lib/supabase'
import { QuoteItemRow, QuoteRow, STATUS_LABEL, money } from './pricingUtils'
import { printQuote } from './quotePrint'

const STYLE: Record<QuoteRow['status'], string> = {
  draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-800', accepted: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-700', sold: 'bg-indigo-100 text-indigo-800',
}
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

/** কোটেশন তালিকা — প্রিন্ট, স্ট্যাটাস, POS-এ বিক্রি (শুধু অ্যাডমিন) */
export default function QuoteList({ isAdmin, onSell, refreshKey }: { isAdmin: boolean; onSell: (quote: QuoteRow, items: QuoteItemRow[], customer: ShopCustomer | null) => void; refreshKey: number }) {
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | QuoteRow['status']>('all')
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) console.error('কোটেশন লোড ত্রুটি:', error)
    setQuotes((data as QuoteRow[]) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [refreshKey])

  const shown = useMemo(() => quotes.filter((q) => (filter === 'all' || q.status === filter) && (!search.trim() || `${q.quote_no} ${q.customer_name || ''} ${q.customer_phone || ''}`.toLowerCase().includes(search.trim().toLowerCase()))), [quotes, filter, search])
  const items = async (id: string) => ((await supabase.from('quote_items').select('*').eq('quote_id', id).order('sort_order')).data || []) as QuoteItemRow[]

  const setStatus = async (q: QuoteRow, s: string) => {
    const { data, error } = await supabase.rpc('set_quote_status', { p_id: q.id, p_status: s })
    if (error || !data?.success) return alert(data?.message || 'স্ট্যাটাস বদলানো যায়নি')
    load()
  }
  const sell = async (q: QuoteRow) => {
    let customer: ShopCustomer | null = null
    if (q.shop_customer_id) customer = ((await supabase.from('shop_customers').select('*').eq('id', q.shop_customer_id).maybeSingle()).data as ShopCustomer) || null
    onSell(q, await items(q.id), customer)
  }
  const remove = async (q: QuoteRow) => {
    if (!window.confirm(`${q.quote_no} মুছবেন?`)) return
    const { error } = await supabase.from('quotes').delete().eq('id', q.id)
    if (error) return alert('মুছতে পারিনি')
    logActivity('কোটেশন মোছা', 'quote', q.quote_no)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="কোটেশন নং / নাম / ফোন" className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-1.5 border border-gray-300 rounded text-sm outline-none">
          <option value="all">সব স্ট্যাটাস</option>
          {(Object.keys(STATUS_LABEL) as QuoteRow['status'][]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {loading ? <p className="text-center text-gray-500 py-8 text-sm">লোড করছি...</p> : shown.length === 0 ? <p className="text-center text-gray-500 py-8 text-sm">কোনো কোটেশন নেই</p> : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {shown.map((q) => {
            const expired = q.valid_until && q.valid_until < todayStr() && !['sold', 'rejected'].includes(q.status)
            return (
              <div key={q.id} className="p-3 flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{q.quote_no} <span className="text-gray-500 font-normal">• {q.customer_name || 'নাম নেই'}{q.customer_phone ? ` (${q.customer_phone})` : ''}</span></p>
                  <p className="text-xs text-gray-500">{format(new Date(q.created_at), 'dd/MM/yyyy')}{q.valid_until ? ` • মেয়াদ ${format(new Date(q.valid_until), 'dd/MM')}` : ''} • <b className="text-gray-800">{money(q.total)}</b></p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STYLE[q.status]}`}>{STATUS_LABEL[q.status]}</span>
                  {expired && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">মেয়াদ শেষ</span>}
                  {q.status !== 'sold' && (
                    <select value={q.status} onChange={(e) => setStatus(q, e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs outline-none">
                      {['draft', 'sent', 'accepted', 'rejected'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s as QuoteRow['status']]}</option>)}
                    </select>
                  )}
                  <button onClick={async () => printQuote(q, await items(q.id))} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded" title="প্রিন্ট"><Printer size={16} /></button>
                  {isAdmin && q.status !== 'sold' && <button onClick={() => sell(q)} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700"><ShoppingCart size={14} /> বিক্রি করুন</button>}
                  {isAdmin && q.status !== 'sold' && <button onClick={() => remove(q)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded" title="মুছুন"><Trash2 size={15} /></button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
