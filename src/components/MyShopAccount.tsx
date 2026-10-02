import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Link2, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ShopSale {
  invoice_no: string
  created_at: string
  total: number
  paid: number
  due: number
  items: string
}
interface ShopAccount {
  linked: boolean
  customer_code?: string
  name?: string
  total_due?: number
  sales?: ShopSale[]
}

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')

/** কাস্টমার ড্যাশবোর্ড — দোকানে (POS) করা আগের কাজ ও বকেয়া */
export default function MyShopAccount() {
  const [acc, setAcc] = useState<ShopAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [total, setTotal] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error: e } = await supabase.rpc('get_my_shop_account')
    if (e) console.error('দোকানের হিসাব লোড ত্রুটি:', e)
    setAcc((data as ShopAccount) || { linked: false })
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const claim = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setError('')
    if (!invoiceNo.trim() || !Number(total)) {
      setError('ইনভয়েস নম্বর ও মোট অঙ্ক দিন')
      return
    }
    setClaiming(true)
    const { data, error: e } = await supabase.rpc('claim_shop_profile', { p_invoice_no: invoiceNo.trim(), p_total: Number(total) })
    setClaiming(false)
    if (e || !data?.success) {
      setError(data?.message || 'যাচাই করতে সমস্যা হয়েছে')
      if (e) console.error('ক্লেইম ত্রুটি:', e)
      return
    }
    setInvoiceNo('')
    setTotal('')
    load()
  }

  if (loading) return <p className="text-center text-charcoal/50 py-12">লোড করছি...</p>

  if (!acc?.linked) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-ink-100 p-6 max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <Link2 size={18} className="text-ink-600" />
          <h3 className="font-semibold text-charcoal">দোকানের হিসাব যুক্ত করুন</h3>
        </div>
        <p className="text-sm text-charcoal/60 mb-4">
          আগে দোকানে এসে কাজ করিয়ে থাকলে দোকানের রশিদ থেকে একটি ইনভয়েস নম্বর ও মোট অঙ্ক দিন। আপনার প্রোফাইলের ফোন নম্বর রশিদের নম্বরের সাথে মিলতে হবে।
        </p>
        <form onSubmit={claim} className="space-y-3">
          <input
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="ইনভয়েস নং (যেমন INV-000123)"
            className="w-full border border-ink-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-ink-400 outline-none"
          />
          <input
            type="number"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="রশিদের মোট অঙ্ক (৳)"
            className="w-full border border-ink-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-ink-400 outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={claiming}
            className="bg-ink-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-ink-700 transition disabled:opacity-50"
          >
            {claiming ? 'যাচাই হচ্ছে...' : 'যাচাই করে যুক্ত করুন'}
          </button>
        </form>
      </div>
    )
  }

  const due = Number(acc.total_due || 0)
  const sales = acc.sales || []
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-5 flex items-center gap-4 ${due > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
        <Wallet className={due > 0 ? 'text-red-600' : 'text-green-600'} size={28} />
        <div>
          <p className="text-sm text-charcoal/60">
            {acc.name} • {acc.customer_code}
          </p>
          <p className={`text-xl font-bold ${due > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {due > 0 ? `আপনার বকেয়া: ${taka(due)}` : 'কোনো বকেয়া নেই'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-ink-100 divide-y divide-ink-50">
        {sales.length === 0 ? (
          <p className="text-center text-charcoal/50 py-10">দোকানে কোনো কাজের হিসাব নেই</p>
        ) : (
          sales.map((s) => (
            <div key={s.invoice_no} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-charcoal">{s.invoice_no}</p>
                <p className="text-xs text-charcoal/50 truncate">
                  {format(new Date(s.created_at), 'dd/MM/yyyy')} • {s.items || '—'}
                </p>
              </div>
              <div className="text-sm text-right">
                <p className="font-semibold text-ink-700">{taka(s.total)}</p>
                {Number(s.due) > 0 ? <p className="text-red-600 font-semibold">বাকি {taka(s.due)}</p> : <p className="text-green-700">পরিশোধিত</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
