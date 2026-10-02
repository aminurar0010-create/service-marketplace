import { useEffect, useRef, useState } from 'react'
import { Search, User, Package, FileText, Loader2 } from 'lucide-react'
import { supabase, ShopCustomerSummary } from '../lib/supabase'

interface InvoiceHit {
  id: string
  invoice_no: string
  customer_name: string | null
  shop_customer_id: string | null
  total_amount: number
  due_amount: number
}
interface OrderHit {
  id: string
  tracking_id: string
  customer_name: string
  status: string
  total_amount: number
}

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')

/** অ্যাডমিন টপবারের Global Search — কাস্টমার (নাম/ফোন/কোড), ইনভয়েস নং, অর্ডার/ট্র্যাকিং নং */
export default function GlobalSearch({
  onOpenCustomer,
  onOpenOrder,
}: {
  onOpenCustomer: (c: ShopCustomerSummary) => void
  onOpenOrder: (orderId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<ShopCustomerSummary[]>([])
  const [invoices, setInvoices] = useState<InvoiceHit[]>([])
  const [orders, setOrders] = useState<OrderHit[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    // PostgREST ফিল্টার ভাঙতে পারে এমন চিহ্ন বাদ
    const q = query.trim().replace(/[,()%*\\]/g, ' ').trim()
    if (q.length < 2) {
      setCustomers([])
      setInvoices([])
      setOrders([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const digits = q.replace(/\D/g, '')
      const custFilter = [`name.ilike.%${q}%`, `customer_code.ilike.%${q}%`, digits.length >= 3 ? `phone.ilike.%${digits}%` : ''].filter(Boolean).join(',')
      const [c, i, o] = await Promise.all([
        supabase.from('shop_customer_summary').select('*').or(custFilter).order('last_activity_at', { ascending: false, nullsFirst: false }).limit(6),
        supabase.from('pos_sales').select('id, invoice_no, customer_name, shop_customer_id, total_amount, due_amount').ilike('invoice_no', `%${q}%`).order('created_at', { ascending: false }).limit(4),
        supabase.from('orders').select('id, tracking_id, customer_name, status, total_amount').ilike('tracking_id', `%${q}%`).order('created_at', { ascending: false }).limit(4),
      ])
      if (cancelled) return
      if (c.error || i.error || o.error) console.error('গ্লোবাল সার্চ ত্রুটি:', c.error || i.error || o.error)
      setCustomers((c.data as ShopCustomerSummary[]) || [])
      setInvoices((i.data as InvoiceHit[]) || [])
      setOrders((o.data as OrderHit[]) || [])
      setLoading(false)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const pickCustomer = (c: ShopCustomerSummary) => {
    onOpenCustomer(c)
    close()
  }

  const pickInvoice = async (inv: InvoiceHit) => {
    if (!inv.shop_customer_id) {
      alert(`${inv.invoice_no} — এই ইনভয়েসে কোনো কাস্টমার যুক্ত নেই (${taka(inv.total_amount)})`)
      return
    }
    const { data } = await supabase.from('shop_customer_summary').select('*').eq('id', inv.shop_customer_id).maybeSingle()
    if (data) pickCustomer(data as ShopCustomerSummary)
  }

  // Enter চাপলে: ফোন নম্বর (১০+ ডিজিট) হলে এবং একজনই কাস্টমার মিললে সরাসরি প্রোফাইল
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close()
    if (e.key !== 'Enter') return
    const digits = query.replace(/\D/g, '')
    if (digits.length >= 10 && customers.length === 1) pickCustomer(customers[0])
    else if (customers.length + invoices.length + orders.length === 1) {
      if (customers[0]) pickCustomer(customers[0])
      else if (invoices[0]) pickInvoice(invoices[0])
      else if (orders[0]) {
        onOpenOrder(orders[0].id)
        close()
      }
    }
  }

  const empty = customers.length + invoices.length + orders.length === 0
  const row = 'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition'

  return (
    <div ref={boxRef} className="relative flex-1 max-w-xl mx-3">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="কাস্টমার নাম / ফোন / কোড, ইনভয়েস, অর্ডার নং"
        className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
      />
      {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
          {empty && !loading && <p className="px-4 py-4 text-sm text-gray-500">কিছু পাওয়া যায়নি</p>}

          {customers.length > 0 && <p className="px-3 pt-2 text-[11px] font-semibold text-gray-400">কাস্টমার</p>}
          {customers.map((c) => (
            <button key={c.id} onClick={() => pickCustomer(c)} className={row}>
              <User size={16} className="text-indigo-500 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{c.name}</span>
                <span className="block text-xs text-gray-500">{c.phone} • {c.customer_code}</span>
              </span>
              {Number(c.total_due) > 0 && <span className="text-xs font-semibold text-red-600">বাকি {taka(c.total_due)}</span>}
            </button>
          ))}

          {invoices.length > 0 && <p className="px-3 pt-2 text-[11px] font-semibold text-gray-400">ইনভয়েস</p>}
          {invoices.map((inv) => (
            <button key={inv.id} onClick={() => pickInvoice(inv)} className={row}>
              <FileText size={16} className="text-emerald-500 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{inv.invoice_no}</span>
                <span className="block text-xs text-gray-500 truncate">{inv.customer_name || 'কাস্টমার নেই'} • {taka(inv.total_amount)}</span>
              </span>
              {Number(inv.due_amount) > 0 && <span className="text-xs font-semibold text-red-600">বাকি {taka(inv.due_amount)}</span>}
            </button>
          ))}

          {orders.length > 0 && <p className="px-3 pt-2 text-[11px] font-semibold text-gray-400">অনলাইন অর্ডার</p>}
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                onOpenOrder(o.id)
                close()
              }}
              className={row}
            >
              <Package size={16} className="text-amber-500 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{o.tracking_id}</span>
                <span className="block text-xs text-gray-500 truncate">{o.customer_name} • {taka(o.total_amount)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
