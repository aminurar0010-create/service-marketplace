import { Award, Pencil } from 'lucide-react'

export default function PerformanceTab({ ctx }: { ctx: any }) {
  const { staffList, profiles, performance, performanceLoading, setEditingProfile } = ctx

  return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <Award className="text-indigo-600" size={22} />
              <div>
                <h2 className="text-xl font-bold">কমিশন ও পারফরম্যান্স</h2>
                <p className="text-sm text-gray-500 mt-1">
                  কমিশন রেট পরিবর্তন করতে "কমিশন এডিট"-এ ক্লিক করুন (স্টাফ প্রোফাইল এডিট থেকে)
                </p>
              </div>
            </div>

            {performanceLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">লোড করছি...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্টাফ</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">কমিশন রেট</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সম্পন্ন অর্ডার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">চলমান অর্ডার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পরিচালিত রাজস্ব</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">মোট কমিশন</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">গড় সম্পন্ন সময়</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                          কোনো স্টাফ পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      performance.map((p: any) => (
                        <tr key={p.staff_id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-semibold">{p.full_name || 'নামহীন স্টাফ'}</td>
                          <td className="px-6 py-4 text-sm">
                            {p.commission_type === 'percentage'
                              ? `${p.commission_rate}%`
                              : `৳${p.commission_rate}`}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-green-700">{p.completed_orders}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{p.active_orders}</td>
                          <td className="px-6 py-4 text-sm">৳{p.total_revenue_handled}</td>
                          <td className="px-6 py-4 text-sm font-bold text-indigo-600">৳{p.total_commission}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {p.avg_completion_hours > 0 ? `${p.avg_completion_hours} ঘণ্টা` : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                const staffProfile = profiles.find((pr: any) => pr.id === p.staff_id) || staffList.find((pr: any) => pr.id === p.staff_id)
                                if (staffProfile) {
                                  setEditingProfile(staffProfile)
                                } else {
                                  alert('প্রোফাইল খুঁজে পেতে আগে "স্টাফ ম্যানেজমেন্ট" ট্যাবে একবার যান')
                                }
                              }}
                              className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-indigo-600"
                            >
                              <Pencil size={14} />
                              কমিশন এডিট
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
  )
}
