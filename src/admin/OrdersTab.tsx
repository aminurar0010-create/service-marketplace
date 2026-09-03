import { useState } from 'react'
import { AlertTriangle, BarChart3, Clock, DollarSign, Download, Eye, Package, Pencil, Printer, TrendingUp, UserCheck, Wand2, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import OrderMemoModal from './OrderMemoModal'
import OrderDetailModal from './OrderDetailModal'

export default function OrdersTab({ ctx }: { ctx: any }) {
  const { orders, staffList, selectedOrderIds, bulkStaffId, setBulkStaffId, bulkStatus, setBulkStatus, bulkProcessing, assigningOrderId, stats, getDeadlineInfo, updateOrderStatus, updateOrderPriority, getPriorityColor, assignStaff, autoAssignStaff, updateOrderPaymentStatus, toggleSelectOrder, toggleSelectAllOrders, clearSelection, bulkAssignStaff, bulkUpdateStatus, exportSelectedCSV, getServiceName, getStatusColor, getStatusLabel } = ctx

  const [memoOrders, setMemoOrders] = useState<any[] | null>(null)
  const [detailOrder, setDetailOrder] = useState<any | null>(null)

  const getPaymentColor = (status: string) => {
    const colors: Record<string, string> = {
      unpaid: 'bg-gray-100 text-gray-600',
      paid: 'bg-green-100 text-green-700',
      refunded: 'bg-orange-100 text-orange-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-600'
  }

  return (
          <>
            {/* পরিসংখ্যান কার্ড */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">মোট অর্ডার</p>
                    <p className="text-3xl font-bold text-indigo-600">{stats.totalOrders}</p>
                  </div>
                  <Package className="w-12 h-12 text-indigo-200" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">মোট রাজস্ব</p>
                    <p className="text-3xl font-bold text-green-600">৳{stats.totalRevenue}</p>
                  </div>
                  <DollarSign className="w-12 h-12 text-green-200" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">আজকের অর্ডার</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.todayOrders}</p>
                  </div>
                  <BarChart3 className="w-12 h-12 text-blue-200" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">আজকের রাজস্ব</p>
                    <p className="text-3xl font-bold text-orange-600">৳{stats.todayRevenue}</p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-orange-200" />
                </div>
              </div>

              <div className={`rounded-lg shadow p-6 ${stats.overdueOrders > 0 ? 'bg-red-50' : 'bg-white'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-semibold">মেয়াদোত্তীর্ণ অর্ডার</p>
                    <p className={`text-3xl font-bold ${stats.overdueOrders > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {stats.overdueOrders}
                    </p>
                  </div>
                  <AlertTriangle className={`w-12 h-12 ${stats.overdueOrders > 0 ? 'text-red-300' : 'text-gray-200'}`} />
                </div>
              </div>
            </div>

            {/* অর্ডার তালিকা */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold">সম্প্রতি অর্ডার</h2>
              </div>

              {selectedOrderIds.length > 0 && (
                <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-indigo-700 whitespace-nowrap">
                    {selectedOrderIds.length}টি অর্ডার সিলেক্ট করা হয়েছে
                  </span>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={bulkStaffId}
                      onChange={(e) => setBulkStaffId(e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="">স্টাফ নির্বাচন করুন</option>
                      {staffList.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || 'নামহীন স্টাফ'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={bulkAssignStaff}
                      disabled={!bulkStaffId || bulkProcessing}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      <UserCheck size={14} />
                      বাল্ক অ্যাসাইন
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    >
                      <option value="">স্ট্যাটাস নির্বাচন করুন</option>
                      <option value="pending">অপেক্ষায়</option>
                      <option value="documents_pending">ডকুমেন্ট বাকি</option>
                      <option value="ready">প্রস্তুত</option>
                      <option value="processing">প্রক্রিয়াধীন</option>
                      <option value="waiting">অপেক্ষমাণ</option>
                      <option value="quality_check">কোয়ালিটি চেক</option>
                      <option value="completed">সম্পন্ন</option>
                      <option value="delivered">ডেলিভার হয়েছে</option>
                      <option value="on_hold">হোল্ডে আছে</option>
                      <option value="rejected">প্রত্যাখ্যাত</option>
                      <option value="cancelled">বাতিল</option>
                    </select>
                    <button
                      onClick={bulkUpdateStatus}
                      disabled={!bulkStatus || bulkProcessing}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      <Pencil size={14} />
                      বাল্ক স্ট্যাটাস
                    </button>
                  </div>

                  <button
                    onClick={() => setMemoOrders(orders.filter((o: any) => selectedOrderIds.includes(o.id)))}
                    title="৪টি করে একসাথে সিলেক্ট করলে এক পৃষ্ঠা A4-তে ৪টি মেমো প্রিন্ট হবে"
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 transition whitespace-nowrap"
                  >
                    <Printer size={14} />
                    মেমো প্রিন্ট
                  </button>

                  <button
                    onClick={exportSelectedCSV}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-sm font-semibold rounded hover:bg-gray-50 transition whitespace-nowrap"
                  >
                    <Download size={14} />
                    CSV এক্সপোর্ট
                  </button>

                  <button
                    onClick={clearSelection}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition whitespace-nowrap ml-auto"
                  >
                    <X size={14} />
                    সিলেকশন বাতিল
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                          onChange={toggleSelectAllOrders}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ট্র্যাকিং ID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">গ্রাহক</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সেবা</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পরিমাণ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পেমেন্ট</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অবস্থা</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">প্রায়োরিটি</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ডেডলাইন</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাসাইন করা স্টাফ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সময়</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                          কোনো অর্ডার পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      orders.map((order: any) => (
                        <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.includes(order.id)}
                              onChange={() => toggleSelectOrder(order.id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm font-mono font-bold text-indigo-600">
                            <div className="flex items-center gap-2">
                              {order.tracking_id}
                              <button
                                onClick={() => setDetailOrder(order)}
                                title="বিস্তারিত দেখুন (কাস্টম তথ্য, ডকুমেন্ট, ট্রানজেকশন আইডি)"
                                className="text-gray-400 hover:text-indigo-600 transition"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => setMemoOrders([order])}
                                title="মেমো প্রিন্ট করুন"
                                className="text-gray-400 hover:text-green-600 transition"
                              >
                                <Printer size={15} />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div>
                              <p className="font-semibold">{order.customer_name}</p>
                              <p className="text-gray-500 text-xs">{order.customer_phone}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">{getServiceName(order.service_id)}</td>
                          <td className="px-6 py-4 text-sm font-semibold">৳{order.total_amount}</td>
                          <td className="px-6 py-4">
                            <select
                              value={order.payment_status}
                              onChange={(e) => updateOrderPaymentStatus(order.id, e.target.value)}
                              title="ম্যানুয়াল পেমেন্ট অ্যাপ্রুভাল (ক্যাশ/অফলাইন পেমেন্ট নিশ্চিত করতে ব্যবহার করুন)"
                              className={`px-2 py-1 rounded-full text-xs font-semibold border-0 outline-none cursor-pointer ${getPaymentColor(order.payment_status)}`}
                            >
                              <option value="unpaid">অপরিশোধিত</option>
                              <option value="paid">পরিশোধিত</option>
                              <option value="refunded">ফেরত</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={order.priority || 'normal'}
                              onChange={(e) => updateOrderPriority(order.id, e.target.value)}
                              className={`px-2 py-1 rounded-full text-xs font-semibold border-0 outline-none cursor-pointer ${getPriorityColor(order.priority)}`}
                            >
                              <option value="low">কম</option>
                              <option value="normal">সাধারণ</option>
                              <option value="important">গুরুত্বপূর্ণ</option>
                              <option value="urgent">জরুরি</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const info = getDeadlineInfo(order)
                              if (!info) return <span className="text-gray-300 text-sm">-</span>
                              return (
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${info.color}`}>
                                  {info.overdue && <AlertTriangle size={12} />}
                                  {!info.overdue && <Clock size={12} />}
                                  {info.label}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <UserCheck size={16} className="text-gray-400 flex-shrink-0" />
                              <select
                                value={order.assigned_staff_id || ''}
                                onChange={(e) => assignStaff(order.id, e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-w-[130px]"
                              >
                                <option value="">অনির্ধারিত</option>
                                {staffList.map((s: any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.full_name || 'নামহীন স্টাফ'}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => autoAssignStaff(order.id)}
                                disabled={assigningOrderId === order.id}
                                title="সিস্টেম অটোমেটিক সবচেয়ে কম-ব্যস্ত স্টাফকে অ্যাসাইন করবে"
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 whitespace-nowrap"
                              >
                                <Wand2 size={14} />
                                {assigningOrderId === order.id ? 'হচ্ছে...' : 'অটো'}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatDistanceToNow(new Date(order.created_at), { locale: bn, addSuffix: true })}
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            >
                              <option value="pending">অপেক্ষায়</option>
                              <option value="documents_pending">ডকুমেন্ট বাকি</option>
                              <option value="ready">প্রস্তুত</option>
                              <option value="processing">প্রক্রিয়াধীন</option>
                              <option value="waiting">অপেক্ষমাণ</option>
                              <option value="quality_check">কোয়ালিটি চেক</option>
                              <option value="completed">সম্পন্ন</option>
                              <option value="delivered">ডেলিভার হয়েছে</option>
                              <option value="on_hold">হোল্ডে আছে</option>
                              <option value="rejected">প্রত্যাখ্যাত</option>
                              <option value="cancelled">বাতিল</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {memoOrders && (
              <OrderMemoModal
                orders={memoOrders}
                getServiceName={getServiceName}
                onClose={() => setMemoOrders(null)}
              />
            )}

            {detailOrder && (
              <OrderDetailModal
                order={detailOrder}
                getServiceName={getServiceName}
                onClose={() => setDetailOrder(null)}
              />
            )}
          </>
  )
}
