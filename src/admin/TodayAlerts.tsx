import { useEffect, useState } from 'react'
import { AlertTriangle, PackageX, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Alerts {
  low_stock_count: number
  out_of_stock_count: number
  due_customers: number
  due_total: number
  old_due_count: number
  old_due_total: number
}

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD')

/** "আজকের কাজ"-এর অ্যালার্ট — কম স্টক ও বকেয়া (ফেজ H-এর SQL লাগে; না থাকলে চুপচাপ লুকিয়ে থাকে) */
export default function TodayAlerts({ onGo }: { onGo?: (tab: string) => void }) {
  const [a, setA] = useState<Alerts | null>(null)
  const [soonTickets, setSoonTickets] = useState(0)

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase.rpc('ai_today_alerts')
      if (error) console.error('অ্যালার্ট লোড ত্রুটি:', error)
      if (data && !data.error) setA(data as Alerts)

      // আজ/কালের মধ্যে যাত্রার টিকিট (ফেজ J; SQL না থাকলে শূন্য থাকে)
      const t0 = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
      const d = new Date(t0 + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 1)
      const { count } = await supabase
        .from('ticket_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['requested', 'booked'])
        .gte('travel_date', t0)
        .lte('travel_date', d.toISOString().slice(0, 10))
      setSoonTickets(count || 0)
    })()
  }, [])

  if (!a && soonTickets === 0) return null
  const items: { key: string; icon: any; tone: string; text: string; tab?: string }[] = []
  if (soonTickets > 0) items.push({ key: 'tk', icon: Wallet, tone: 'bg-sky-50 border-sky-200 text-sky-800', text: `${soonTickets.toLocaleString('bn-BD')}টি টিকিটের যাত্রা আজ/কালের মধ্যে`, tab: 'tickets' })
  if (a && a.out_of_stock_count > 0) items.push({ key: 'oos', icon: PackageX, tone: 'bg-red-50 border-red-200 text-red-800', text: `${a.out_of_stock_count}টি পণ্যের স্টক শেষ`, tab: 'inventory' })
  if (a && a.low_stock_count > 0) items.push({ key: 'low', icon: AlertTriangle, tone: 'bg-amber-50 border-amber-200 text-amber-800', text: `${a.low_stock_count}টি পণ্যের স্টক কম`, tab: 'inventory' })
  if (a && a.due_customers > 0) items.push({ key: 'due', icon: Wallet, tone: 'bg-orange-50 border-orange-200 text-orange-800', text: `${a.due_customers} জনের কাছে মোট ${taka(a.due_total)} বকেয়া`, tab: 'due_collection' })
  if (a && a.old_due_count > 0) items.push({ key: 'old', icon: Wallet, tone: 'bg-red-50 border-red-200 text-red-800', text: `${a.old_due_count} জনের বকেয়া ৩০ দিনের বেশি পুরনো (${taka(a.old_due_total)})`, tab: 'due_collection' })
  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((i) => {
        const Icon = i.icon
        const clickable = i.tab && onGo
        return (
          <button
            key={i.key}
            type="button"
            disabled={!clickable}
            onClick={() => i.tab && onGo?.(i.tab)}
            className={`flex items-center gap-3 border rounded-xl px-4 py-3 text-left text-sm font-semibold ${i.tone} ${clickable ? 'hover:brightness-95 transition' : 'cursor-default'}`}
          >
            <Icon size={18} className="shrink-0" />
            {i.text}
          </button>
        )
      })}
    </div>
  )
}
