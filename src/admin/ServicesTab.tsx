import { Layers, Pencil, Plus, Trash2 } from 'lucide-react'

export default function ServicesTab({ ctx }: { ctx: any }) {
  const { services, setShowServiceModal, setEditingService, toggleServiceActive, deleteService } = ctx

  return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Layers className="text-indigo-600" size={22} />
                <div>
                  <h2 className="text-xl font-bold">সার্ভিস তালিকা</h2>
                  <p className="text-sm text-gray-500 mt-1">সার্ভিস অ্যাড, এডিট বা ডিলিট করুন</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingService(null)
                  setShowServiceModal(true)
                }}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
              >
                <Plus size={16} />
                নতুন সার্ভিস
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">নাম</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ক্যাটাগরি</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">দাম</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্ট্যাটাস</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        কোনো সার্ভিস পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    services.map((s) => (
                      <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">
                          <p className="font-semibold">{s.name}</p>
                          {s.description && (
                            <p className="text-gray-500 text-xs mt-0.5">{s.description}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{s.category}</td>
                        <td className="px-6 py-4 text-sm font-semibold">৳{s.price}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              s.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {s.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setEditingService(s)
                                setShowServiceModal(true)
                              }}
                              className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-indigo-600"
                            >
                              <Pencil size={14} />
                              এডিট
                            </button>
                            <button
                              onClick={() => toggleServiceActive(s)}
                              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              {s.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                            </button>
                            <button
                              onClick={() => deleteService(s)}
                              className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={14} />
                              ডিলিট
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
  )
}
