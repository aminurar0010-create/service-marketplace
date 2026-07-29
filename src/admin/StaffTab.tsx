import { Settings, Shield } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'

export default function StaffTab({ ctx }: { ctx: any }) {
  const { profiles, staffLoading, setEditingProfile, user, toggleRole } = ctx

  return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <Shield className="text-indigo-600" size={22} />
              <div>
                <h2 className="text-xl font-bold">স্টাফ ও অ্যাডমিন তালিকা</h2>
                <p className="text-sm text-gray-500 mt-1">
                  নতুন স্টাফ যোগ করতে হলে Supabase Authentication থেকে ইউজার তৈরি করে
                  তার UID দিয়ে profiles টেবিলে row যোগ করতে হবে।
                </p>
              </div>
            </div>

            {staffLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">লোড করছি...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">নাম</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ফোন</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্পেশালাইজেশন</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">সর্বোচ্চ অর্ডার</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Available</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">যোগদান</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                          কোনো প্রোফাইল পাওয়া যায়নি
                        </td>
                      </tr>
                    ) : (
                      profiles.map((p: any) => (
                        <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-semibold">
                            {p.full_name || '(নাম নেই)'}
                            {p.id === user.id && (
                              <span className="ml-2 text-xs text-indigo-600 font-normal">(আপনি)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{p.phone || '-'}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                p.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {p.role === 'admin' ? 'অ্যাডমিন' : 'স্টাফ'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {p.specialization && p.specialization.length > 0
                              ? p.specialization.join(', ')
                              : <span className="text-gray-400">সব ধরনের কাজ</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {p.max_concurrent_orders ?? 10}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                p.is_available
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {p.is_available ? 'হ্যাঁ' : 'না'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatDistanceToNow(new Date(p.created_at), { locale: bn, addSuffix: true })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setEditingProfile(p)}
                                className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-indigo-600"
                              >
                                <Settings size={14} />
                                এডিট
                              </button>
                              <button
                                onClick={() => toggleRole(p.id, p.role)}
                                disabled={p.id === user.id}
                                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                              >
                                {p.role === 'admin' ? 'স্টাফ বানাও' : 'অ্যাডমিন বানাও'}
                              </button>
                            </div>
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
