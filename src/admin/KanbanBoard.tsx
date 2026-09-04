import { useState } from 'react'

const COLUMNS = [
  { key: 'pending', label: 'অপেক্ষায়' },
  { key: 'documents_pending', label: 'ডকুমেন্ট বাকি' },
  { key: 'ready', label: 'প্রস্তুত' },
  { key: 'processing', label: 'প্রক্রিয়াধীন' },
  { key: 'waiting', label: 'অপেক্ষমাণ' },
  { key: 'quality_check', label: 'কোয়ালিটি চেক' },
  { key: 'completed', label: 'সম্পন্ন' },
  { key: 'delivered', label: 'ডেলিভার হয়েছে' },
  { key: 'on_hold', label: 'হোল্ড/বাতিল' },
]

// on_hold কলামে cancelled/rejected/on_hold — তিনটাই একসাথে দেখানো হয় যাতে বোর্ড বেশি চওড়া না হয়ে যায়
const belongsToColumn = (status: string, columnKey: string) => {
  if (columnKey === 'on_hold') return ['on_hold', 'cancelled', 'rejected'].includes(status)
  return status === columnKey
}

export default function KanbanBoard({ ctx, orders: ordersOverride }: { ctx: any; orders?: any[] }) {
  const { orders: allOrders, getServiceName, getPriorityColor, getPriorityLabel, updateOrderStatus, getDeadlineInfo } = ctx
  const orders = ordersOverride ?? allOrders
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const handleDrop = (columnKey: string) => {
    if (draggedId) {
      // "হোল্ড/বাতিল" কলামে ড্রপ করলে ডিফল্টভাবে on_hold ধরা হবে — cancelled/rejected চাইলে টেবিল ভিউ থেকে বদলাতে হবে
      updateOrderStatus(draggedId, columnKey)
    }
    setDraggedId(null)
    setDragOverCol(null)
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {COLUMNS.map((col) => {
          const columnOrders = orders.filter((o: any) => belongsToColumn(o.status, col.key))
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverCol(col.key)
              }}
              onDragLeave={() => setDragOverCol((prev) => (prev === col.key ? null : prev))}
              onDrop={() => handleDrop(col.key)}
              className={`w-64 flex-shrink-0 rounded-lg border ${
                dragOverCol === col.key ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">{col.label}</h3>
                <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
                  {columnOrders.length}
                </span>
              </div>
              <div className="p-2 space-y-2 min-h-[80px] max-h-[70vh] overflow-y-auto">
                {columnOrders.map((order: any) => {
                  const deadlineInfo = getDeadlineInfo?.(order)
                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={() => setDraggedId(order.id)}
                      onDragEnd={() => setDraggedId(null)}
                      className={`bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm cursor-move hover:shadow-md transition ${
                        draggedId === order.id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-indigo-600">{order.tracking_id}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${getPriorityColor(order.priority)}`}
                        >
                          {getPriorityLabel(order.priority)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 truncate">{order.customer_name}</p>
                      <p className="text-xs text-gray-500 truncate">{getServiceName(order.service_id)}</p>
                      {deadlineInfo?.overdue && (
                        <p className="text-[10px] text-red-600 font-semibold mt-1">⚠ মেয়াদোত্তীর্ণ</p>
                      )}
                    </div>
                  )
                })}
                {columnOrders.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">কোনো অর্ডার নেই</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
