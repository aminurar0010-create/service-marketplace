import { useState } from 'react'
import { Sparkles, Search } from 'lucide-react'

// ============================================================
// স্মার্ট প্রশ্ন বক্স — সম্পূর্ণ ফ্রি, কোনো বাইরের AI API ছাড়াই।
// এটা "real" AI না — নির্দিষ্ট কিছু চেনা প্রশ্নের প্যাটার্ন ধরে সাইটের
// ইতিমধ্যে লোড হওয়া ডেটা (অর্ডার/সার্ভিস) থেকে হিসাব করে উত্তর দেখায়।
// ============================================================

const SUGGESTIONS = [
  'আজ কী কাজ আছে',
  'পেন্ডিং কাজ কী কী',
  'আজকের আয় কত',
  'এই মাসে কোন সার্ভিস বেশি লাভ করেছে',
  'কোন অর্ডারে ডকুমেন্ট বাকি',
]

type Answer = {
  summary: string
  rows?: { title: string; subtitle: string }[]
}

export default function SmartAssistant({ ctx }: { ctx: any }) {
  const { orders, services, stats, getServiceName, getStatusLabel, getDeadlineInfo } = ctx
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [notUnderstood, setNotUnderstood] = useState(false)

  const activeOrders = () =>
    orders.filter((o: any) => !['completed', 'cancelled', 'delivered', 'rejected'].includes(o.status))

  const thisMonthOrders = () => {
    const now = new Date()
    return orders.filter((o: any) => {
      const d = new Date(o.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
  }

  const handleAsk = (raw: string) => {
    const q = raw.trim()
    setQuery(q)
    setNotUnderstood(false)
    if (!q) {
      setAnswer(null)
      return
    }

    // ১) আজকের কাজ
    if (/আজ.*কাজ|today.*task/i.test(q)) {
      const active = activeOrders()
      const overdue = active.filter((o: any) => getDeadlineInfo?.(o)?.overdue)
      const urgent = active.filter((o: any) => o.priority === 'urgent')
      const missingDocs = active.filter((o: any) => o.status === 'documents_pending')
      setAnswer({
        summary: `আজকে সক্রিয় অর্ডার ${active.length}টা — এর মধ্যে মেয়াদোত্তীর্ণ ${overdue.length}টা, জরুরি ${urgent.length}টা, ডকুমেন্ট বাকি ${missingDocs.length}টা।`,
        rows: [...overdue, ...urgent].slice(0, 8).map((o: any) => ({
          title: `${o.tracking_id} — ${o.customer_name}`,
          subtitle: `${getServiceName(o.service_id)} • ${getStatusLabel(o.status)}`,
        })),
      })
      return
    }

    // ২) পেন্ডিং কাজ
    if (/পেন্ডিং|pending/i.test(q)) {
      const pending = orders.filter((o: any) => o.status === 'pending')
      setAnswer({
        summary: `"অপেক্ষায়" অবস্থায় থাকা অর্ডার মোট ${pending.length}টা।`,
        rows: pending.slice(0, 8).map((o: any) => ({
          title: `${o.tracking_id} — ${o.customer_name}`,
          subtitle: getServiceName(o.service_id),
        })),
      })
      return
    }

    // ৩) আজকের আয়
    if (/আজকের?.*(আয়|রেভিনিউ|revenue|income)/i.test(q)) {
      setAnswer({
        summary: `আজকের মোট আয় ৳${(stats?.todayRevenue || 0).toLocaleString('bn-BD')} (${
          stats?.todayOrders || 0
        }টা অর্ডার থেকে)।`,
      })
      return
    }

    // ৪) এই মাসের আয়
    if (/মাসের?.*(আয়|রেভিনিউ|revenue)|month.*revenue/i.test(q)) {
      const monthOrders = thisMonthOrders()
      const total = monthOrders.reduce((s: number, o: any) => s + o.total_amount, 0)
      setAnswer({ summary: `এই মাসে মোট আয় ৳${total.toLocaleString('bn-BD')} (${monthOrders.length}টা অর্ডার থেকে)।` })
      return
    }

    // ৫) কোন সার্ভিস বেশি লাভ করেছে (এই মাসে)
    if (/(লাভ|profit).*সার্ভিস|সার্ভিস.*(লাভ|profit)/i.test(q)) {
      const monthFinished = thisMonthOrders().filter((o: any) => ['completed', 'delivered'].includes(o.status))
      const grouped: Record<string, { count: number; revenue: number }> = {}
      monthFinished.forEach((o: any) => {
        if (!grouped[o.service_id]) grouped[o.service_id] = { count: 0, revenue: 0 }
        grouped[o.service_id].count++
        grouped[o.service_id].revenue += o.total_amount
      })
      const ranked = Object.entries(grouped)
        .map(([serviceId, g]) => {
          const svc = services.find((s: any) => s.id === serviceId)
          const cost = ((svc?.internal_cost || 0) + (svc?.material_cost || 0) + (svc?.other_cost || 0)) * g.count
          return { name: svc?.name || 'অজানা', profit: g.revenue - cost, count: g.count }
        })
        .sort((a, b) => b.profit - a.profit)

      if (ranked.length === 0) {
        setAnswer({ summary: 'এই মাসে এখনো কোনো অর্ডার সম্পন্ন হয়নি।' })
      } else {
        setAnswer({
          summary: `এই মাসে সবচেয়ে বেশি লাভ করেছে "${ranked[0].name}" — আনুমানিক ৳${ranked[0].profit.toLocaleString('bn-BD')}।`,
          rows: ranked.slice(0, 5).map((r) => ({
            title: r.name,
            subtitle: `${r.count}টা অর্ডার • প্রফিট ৳${r.profit.toLocaleString('bn-BD')}`,
          })),
        })
      }
      return
    }

    // ৬) কোন অর্ডারে ডকুমেন্ট বাকি
    if (/ডকুমেন্ট.*বাকি|missing.*doc/i.test(q)) {
      const missing = orders.filter((o: any) => o.status === 'documents_pending')
      setAnswer({
        summary: `ডকুমেন্ট বাকি আছে এমন অর্ডার ${missing.length}টা।`,
        rows: missing.slice(0, 8).map((o: any) => ({
          title: `${o.tracking_id} — ${o.customer_name}`,
          subtitle: getServiceName(o.service_id),
        })),
      })
      return
    }

    // ৭) ফলব্যাক — কাস্টমারের নাম দিয়ে খোঁজা (যেকোনো শব্দকে নাম ধরে চেষ্টা করা হয়)
    const nameGuess = q.replace(/(এর|র)\s*(সব|সকল)?\s*(অর্ডার|order)?/gi, '').trim()
    const matched = orders.filter((o: any) =>
      o.customer_name?.toLowerCase().includes(nameGuess.toLowerCase())
    )
    if (nameGuess.length >= 2 && matched.length > 0) {
      setAnswer({
        summary: `"${nameGuess}" নামে ${matched.length}টা অর্ডার পাওয়া গেছে।`,
        rows: matched.slice(0, 8).map((o: any) => ({
          title: `${o.tracking_id} — ৳${o.total_amount}`,
          subtitle: `${getServiceName(o.service_id)} • ${getStatusLabel(o.status)}`,
        })),
      })
      return
    }

    setAnswer(null)
    setNotUnderstood(true)
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-4 mb-6">
      <p className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 mb-3">
        <Sparkles size={16} /> জিজ্ঞেস করুন (ফ্রি স্মার্ট সহকারী)
      </p>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleAsk(e.target.value)}
          placeholder='যেমনঃ "আজ কী কাজ আছে" বা "রহিমের অর্ডার"'
          className="w-full border border-indigo-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {!answer && !notUnderstood && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleAsk(s)}
              className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-50 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {notUnderstood && (
        <p className="text-sm text-gray-500">
          এই প্রশ্নটা এখনো বুঝতে পারছি না — উপরের উদাহরণগুলোর মতো জিজ্ঞেস করে দেখুন, বা কারো নাম লিখে খুঁজুন।
        </p>
      )}

      {answer && (
        <div className="bg-white rounded-lg p-3 border border-indigo-100">
          <p className="text-sm font-semibold text-gray-800 mb-2">{answer.summary}</p>
          {answer.rows && answer.rows.length > 0 && (
            <div className="space-y-1.5">
              {answer.rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2.5 py-1.5">
                  <span className="font-semibold text-gray-700">{r.title}</span>
                  <span className="text-gray-500">{r.subtitle}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
