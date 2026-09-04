import { useEffect, useMemo, useState } from 'react'
import { PieChart, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { supabase, CashTransaction, Order, Service } from '../lib/supabase'

const SLICE_COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#db2777', '#65a30d']

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7) // YYYY-MM
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
}

export default function ReportsTab({ services, orders }: { services: Service[]; orders: Order[] }) {
  const [cashTx, setCashTx] = useState<CashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    fetchCashTx()
  }, [])

  const fetchCashTx = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('cash_transactions').select('*')
      if (error) throw error
      setCashTx(data || [])
    } catch (error) {
      console.error('ক্যাশ ডেটা লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  // --- সবচেয়ে জনপ্রিয় সার্ভিস (পাই চার্ট) ---
  const popularServices = useMemo(() => {
    const counts: Record<string, number> = {}
    orders.forEach((o) => {
      counts[o.service_id] = (counts[o.service_id] || 0) + 1
    })
    const total = orders.length || 1
    return Object.entries(counts)
      .map(([serviceId, count]) => ({
        serviceId,
        name: services.find((s) => s.id === serviceId)?.name || 'অজানা সার্ভিস',
        count,
        percent: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [orders, services])

  const pieSlices = useMemo(() => {
    let angle = 0
    return popularServices.map((s, i) => {
      const sliceAngle = (s.percent / 100) * 360
      const path = arcPath(100, 100, 90, angle, angle + sliceAngle)
      angle += sliceAngle
      return { ...s, path, color: SLICE_COLORS[i % SLICE_COLORS.length] }
    })
  }, [popularServices])

  // --- সার্ভিস-ভিত্তিক প্রফিট রিপোর্ট (completed/delivered অর্ডার থেকে) ---
  const serviceProfitReport = useMemo(() => {
    const finishedOrders = orders.filter((o) => ['completed', 'delivered'].includes(o.status))
    const grouped: Record<string, { count: number; revenue: number }> = {}
    finishedOrders.forEach((o) => {
      if (!grouped[o.service_id]) grouped[o.service_id] = { count: 0, revenue: 0 }
      grouped[o.service_id].count++
      grouped[o.service_id].revenue += o.total_amount
    })
    return Object.entries(grouped)
      .map(([serviceId, g]) => {
        const svc = services.find((s) => s.id === serviceId)
        const perOrderCost = (svc?.internal_cost || 0) + (svc?.material_cost || 0) + (svc?.other_cost || 0)
        const totalCost = perOrderCost * g.count
        const profit = g.revenue - totalCost
        return {
          serviceId,
          name: svc?.name || 'অজানা সার্ভিস',
          count: g.count,
          revenue: g.revenue,
          cost: totalCost,
          profit,
        }
      })
      .sort((a, b) => b.profit - a.profit)
  }, [orders, services])

  // --- মাসিক প্রফিট-লস ---
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    orders.forEach((o) => months.add(monthKey(o.created_at)))
    cashTx.forEach((t) => months.add(monthKey(t.entry_date)))
    months.add(new Date().toISOString().slice(0, 7))
    return Array.from(months).sort().reverse()
  }, [orders, cashTx])

  const monthlyReport = useMemo(() => {
    const orderRevenue = orders
      .filter((o) => monthKey(o.created_at) === selectedMonth && o.payment_status === 'paid')
      .reduce((sum, o) => sum + Number(o.total_amount), 0)

    const cashIncome = cashTx
      .filter((t) => monthKey(t.entry_date) === selectedMonth && t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const cashExpense = cashTx
      .filter((t) => monthKey(t.entry_date) === selectedMonth && t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalRevenue = orderRevenue + cashIncome
    const profit = totalRevenue - cashExpense

    return { orderRevenue, cashIncome, cashExpense, totalRevenue, profit }
  }, [orders, cashTx, selectedMonth])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="text-indigo-600" size={22} />
            মান্থলি প্রফিট-লস রিপোর্ট
          </h2>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 font-semibold">অর্ডার থেকে আয় (পেইড)</p>
              <p className="text-xl font-bold text-gray-800 mt-1">৳{monthlyReport.orderRevenue}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                <TrendingUp size={12} /> ক্যাশ আয়
              </p>
              <p className="text-xl font-bold text-green-700 mt-1">৳{monthlyReport.cashIncome}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                <TrendingDown size={12} /> মোট ব্যয়
              </p>
              <p className="text-xl font-bold text-red-700 mt-1">৳{monthlyReport.cashExpense}</p>
            </div>
            <div className={`rounded-lg p-4 ${monthlyReport.profit >= 0 ? 'bg-indigo-50' : 'bg-red-50'}`}>
              <p className="text-xs text-gray-500 font-semibold">নিট লাভ/ক্ষতি</p>
              <p className={`text-xl font-bold mt-1 ${monthlyReport.profit >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                ৳{monthlyReport.profit}
              </p>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-4">
          * নিট লাভ = (পেইড অর্ডার রাজস্ব + ক্যাশ-বুক আয়) − ক্যাশ-বুক ব্যয়। স্টাফ কমিশন "কমিশন ও পারফরম্যান্স" ট্যাবে আলাদাভাবে দেখা যাবে।
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <PieChart className="text-indigo-600" size={22} />
          সবচেয়ে জনপ্রিয় সার্ভিস
        </h2>

        {popularServices.length === 0 ? (
          <p className="text-center text-gray-500 py-8">এখনো কোনো অর্ডার নেই</p>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-8">
            <svg viewBox="0 0 200 200" className="w-56 h-56 flex-shrink-0">
              {pieSlices.map((slice) => (
                <path key={slice.serviceId} d={slice.path} fill={slice.color} stroke="#fff" strokeWidth="1" />
              ))}
            </svg>
            <div className="flex-1 w-full space-y-2">
              {pieSlices.map((slice) => (
                <div key={slice.serviceId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
                    <span className="font-medium text-gray-700">{slice.name}</span>
                  </div>
                  <span className="text-gray-500">
                    {slice.count}টি অর্ডার ({slice.percent.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <TrendingUp className="text-green-600" size={22} />
          সার্ভিস-ভিত্তিক প্রফিট রিপোর্ট
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          শুধু সম্পন্ন/ডেলিভার হওয়া অর্ডার থেকে হিসাব করা — Service-এ খরচ (কস্ট) সেট করা না থাকলে প্রফিট = রেভিনিউ দেখাবে।
        </p>
        {serviceProfitReport.length === 0 ? (
          <p className="text-center text-gray-500 py-8">এখনো কোনো সম্পন্ন অর্ডার নেই</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="py-2 pr-4">সার্ভিস</th>
                  <th className="py-2 pr-4">অর্ডার</th>
                  <th className="py-2 pr-4">রেভিনিউ</th>
                  <th className="py-2 pr-4">খরচ</th>
                  <th className="py-2 pr-4">প্রফিট</th>
                </tr>
              </thead>
              <tbody>
                {serviceProfitReport.map((s) => (
                  <tr key={s.serviceId} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium text-gray-800">{s.name}</td>
                    <td className="py-2 pr-4">{s.count}</td>
                    <td className="py-2 pr-4">৳{s.revenue.toLocaleString('bn-BD')}</td>
                    <td className="py-2 pr-4 text-red-600">৳{s.cost.toLocaleString('bn-BD')}</td>
                    <td className="py-2 pr-4 font-semibold text-green-700">৳{s.profit.toLocaleString('bn-BD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
