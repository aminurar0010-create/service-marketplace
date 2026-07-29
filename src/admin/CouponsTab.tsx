import { Pencil, Plus, Ticket, Trash2 } from 'lucide-react'

export default function CouponsTab({ ctx }: { ctx: any }) {
  const { coupons, couponsLoading, setShowCouponModal, setEditingCoupon, toggleCouponActive, deleteCoupon, isCouponExpired } = ctx

  return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Ticket className="text-indigo-600" size={22} />
                <div>
                  <h2 className="text-xl font-bold">কুপন তালিকা</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    ডিসকাউন্ট কুপন তৈরি, এডিট ও নিষ্ক্রিয় করুন
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingCoupon(null)
                  setShowCouponModal(true)
                }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
              >
                <Plus size={16} />
                নতুন কুপন
              </button>
            </div>

            {couponsLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">লোড করছি...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">কোড</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ছাড়</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সর্বনিম্ন অর্ডার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ব্যবহার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">মেয়াদ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্ট্যাটাস</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          কোনো কুপন পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      coupons.map((c: any) => {
                        const expired = isCouponExpired(c)
                        return (
                          <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm">
                              <p className="font-mono font-bold text-indigo-600">{c.code}</p>
                              {c.description && (
                                <p className="text-gray-500 text-xs mt-0.5">{c.description}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold">
                              {c.discount_type === 'percentage' ? `${c.discount_value}%` : `৳${c.discount_value}`}
                              {c.discount_type === 'percentage' && c.max_discount_amount && (
                                <p className="text-gray-500 text-xs font-normal">
                                  সর্বোচ্চ ৳{c.max_discount_amount}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">৳{c.min_order_amount}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {c.used_count}
                              {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                              <p className="text-gray-500 text-xs">প্রতি গ্রাহক: {c.usage_limit_per_customer}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {c.valid_until
                                ? new Date(c.valid_until).toLocaleDateString('bn-BD')
                                : 'সীমাহীন'}
                            </td>
                            <td className="px-6 py-4">
                              {expired ? (
                                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                  মেয়াদোত্তীর্ণ
                                </span>
                              ) : (
                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                    c.is_active
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {c.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => {
                                    setEditingCoupon(c)
                                    setShowCouponModal(true)
                                  }}
                                  className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-indigo-600"
                                >
                                  <Pencil size={14} />
                                  এডিট
                                </button>
                                <button
                                  onClick={() => toggleCouponActive(c)}
                                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                >
                                  {c.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                                </button>
                                <button
                                  onClick={() => deleteCoupon(c)}
                                  className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-800"
                                >
                                  <Trash2 size={14} />
                                  ডিলিট
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
  )
}
