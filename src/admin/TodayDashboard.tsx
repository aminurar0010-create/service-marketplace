import { useState } from 'react'
import { AlertTriangle, Clock3, Zap, FileWarning, Loader2, CheckCircle2 } from 'lucide-react'
import QuickOrderModal from './QuickOrderModal'

// "আজকের কাজ" ড্যাশবোর্ড — Admin login করলেই সবচেয়ে আগে এটা দেখা যায়।
// লক্ষ্য: একনজরে বোঝা যাক আজ কোন কাজগুলো আগে করা দরকার।
export default function TodayDashboard({ ctx }: { ctx: any }) {
  const { orders, staffList, getServiceName, getDeadlineInfo, getStatusLabel, getPriorityLabel, getPriorityColor, stats } = ctx
  const [showQuickOrder, setShowQuickOrder] = useState(false)

  const activeOrders = orders.filter(
    (o: any) => !['completed', 'cancelled', 'delivered', 'rejected'].includes(o.status)
  )

  const overdue = activeOrders.filter((o: any) => getDeadlineInfo(o)?.overdue)

  const dueToday = activeOrders.filter((o: any) => {
    if (!o.deadline_at) return false
    const info = getDeadlineInfo(o)
    if (!info || info.overdue) return false
    const hoursLeft = (new Date(o.deadline_at).getTime() - Date.now()) / (1000 * 60 * 60)
    return hoursLeft >= 0 && hoursLeft <= 24
  })

  const urgent = activeOrders.filter((o: any) => o.priority === 'urgent' || o.is_urgent)

  const missingDocs = activeOrders.filter((o: any) => o.status === 'documents_pending')

  const processing = activeOrders.filter((o: any) => o.status === 'processing')

  const today = new Date().toDateString()
  const completedToday = orders.filter(
    (o: any) =>
      ['completed', 'delivered'].includes(o.status) &&
      o.updated_at &&
      new Date(o.updated_at).toDateString() === today
  )

  const widgets = [
    { key: 'overdue', label: 'মেয়াদোত্তীর্ণ', icon: AlertTriangle, count: overdue.length, list: overdue, color: 'red' },
    { key: 'dueToday', label: 'আজ শেষ করতে হবে', icon: Clock3, count: dueToday.length, list: dueToday, color: 'orange' },
    { key: 'urgent', label: 'জরুরি', icon: Zap, count: urgent.length, list: urgent, color: 'amber' },
    { key: 'missingDocs', label: 'ডকুমেন্ট বাকি', icon: FileWarning, count: missingDocs.length, list: missingDocs, color: 'yellow' },
    { key: 'processing', label: 'প্রক্রিয়াধীন', icon: Loader2, count: processing.length, list: processing, color: 'blue' },
    { key: 'completedToday', label: 'আজ সম্পন্ন', icon: CheckCircle2, count: completedToday.length, list: completedToday, color: 'green' },
  ]

  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    red: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: 'text-red-500' },
    orange: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
    amber: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
    yellow: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: 'text-yellow-500' },
    blue: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
    green: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: 'text-green-500' },
  }

  const getStaffName = (id?: string) => staffList.find((s: any) => s.id === id)?.full_name || 'অনির্ধারিত'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">আজকের কাজ</h2>
          <p className="text-sm text-gray-500">
            আজকের আয়: <span className="font-semibold">৳{(stats?.todayRevenue || 0).toLocaleString('bn-BD')}</span> •
            {' '}আজকের অর্ডার: <span className="font-semibold">{stats?.todayOrders || 0}</span>
          </p>
        </div>
        <button
          onClick={() => setShowQuickOrder(true)}
          className="flex items-center gap-2 bg-amber-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-amber-600 transition shadow"
        >
          <Zap size={16} /> কুইক অর্ডার
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {widgets.map((w) => {
          const c = colorClasses[w.color]
          const Icon = w.icon
          return (
            <div key={w.key} className={`border rounded-xl p-4 ${c.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <Icon size={20} className={c.icon} />
                <span className={`text-2xl font-bold ${c.text}`}>{w.count}</span>
              </div>
              <p className={`text-sm font-semibold ${c.text}`}>{w.label}</p>
            </div>
          )
        })}
      </div>

      {widgets
        .filter((w) => w.count > 0)
        .map((w) => (
          <div key={w.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <w.icon size={16} className={colorClasses[w.color].icon} />
              <h3 className="font-semibold text-gray-800">{w.label} ({w.count})</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {w.list.slice(0, 8).map((order: any) => (
                <div key={order.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {order.tracking_id} — {order.customer_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getServiceName(order.service_id)} • {getStatusLabel(order.status)} •{' '}
                      {getStaffName(order.assigned_staff_id)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-semibold ${getPriorityColor(order.priority)}`}
                  >
                    {getPriorityLabel(order.priority)}
                  </span>
                </div>
              ))}
              {w.list.length > 8 && (
                <p className="px-4 py-2 text-xs text-gray-400">
                  আরও {w.list.length - 8}টা — সম্পূর্ণ তালিকার জন্য "অর্ডার" ট্যাবে যান
                </p>
              )}
            </div>
          </div>
        ))}

      {overdue.length === 0 && dueToday.length === 0 && urgent.length === 0 && missingDocs.length === 0 && processing.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-2 text-green-400" />
          আজকের জন্য জরুরি কোনো কাজ বাকি নেই 🎉
        </div>
      )}

      {showQuickOrder && <QuickOrderModal ctx={ctx} onClose={() => setShowQuickOrder(false)} />}
    </div>
  )
}
