import { useEffect, useState } from 'react'
import { supabase, Service } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ShoppingCart, Zap, Award, Clock } from 'lucide-react'

export default function Home() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('সার্ভিস লোড করতে ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  // category অনুযায়ী services গ্রুপ করা
  const groupedServices = services.reduce((groups: Record<string, Service[]>, service) => {
    const category = service.category || 'অন্যান্য'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(service)
    return groups
  }, {})

  // category গুলো alphabetically সাজানো (চাইলে এখানে fixed order ও দেওয়া যাবে)
  const categoryNames = Object.keys(groupedServices).sort()

  return (
    <div className="min-h-screen">
      {/* হিরো সেকশন */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">সেবা মার্কেটপ্লেসে স্বাগতম</h1>
          <p className="text-xl text-indigo-100 mb-8">
            আপনার সকল প্রয়োজনের জন্য সর্বোত্তম সেবা খুঁজে পান
          </p>
          <Link
            to="/order"
            className="inline-flex items-center gap-2 bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            <ShoppingCart size={20} />
            এখনই অর্ডার করুন
          </Link>
        </div>
      </div>

      {/* বৈশিষ্ট্য সেকশন */}
      <div className="py-16 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">কেন আমাদের বেছে নিবেন?</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <Zap className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">দ্রুত সেবা</h3>
              <p className="text-gray-600">সর্বোচ্চ মানের সেবা দ্রুত সময়ে পাবেন</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <Award className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">বিশ্বস্ত</h3>
              <p className="text-gray-600">হাজারো সন্তুষ্ট গ্রাহক আমাদের বিশ্বাস করেন</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <Clock className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">সময়মত ডেলিভারি</h3>
              <p className="text-gray-600">সময়ের মধ্যে আপনার কাজ শেষ করা হবে</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <ShoppingCart className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">সহজ অর্ডার</h3>
              <p className="text-gray-600">মাত্র কয়েকটি ক্লিকে অর্ডার সম্পন্ন করুন</p>
            </div>
          </div>
        </div>
      </div>

      {/* সার্ভিস ক্যাটালগ - ক্যাটাগরি অনুযায়ী গ্রুপকৃত */}
      <div className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-12">আমাদের সেবাসমূহ</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">সেবা লোড করছি...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-500 text-lg">কোনো সেবা পাওয়া যায়নি</p>
            </div>
          ) : (
            <div className="space-y-16">
              {categoryNames.map((categoryName) => (
                <div key={categoryName}>
                  {/* ক্যাটাগরি হেডিং */}
                  <div className="flex items-center gap-4 mb-8">
                    <h3 className="text-2xl font-bold text-gray-800">{categoryName}</h3>
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <span className="text-sm text-gray-400">
                      {groupedServices[categoryName].length} টি সেবা
                    </span>
                  </div>

                  {/* এই ক্যাটাগরির সার্ভিস কার্ডগুলো */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {groupedServices[categoryName].map((service) => (
                      <div key={service.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                        <div className="bg-gradient-to-r from-indigo-500 to-blue-600 h-32 flex items-center justify-center">
                          <div className="text-white text-4xl font-bold">{service.name.charAt(0)}</div>
                        </div>
                        <div className="p-6">
                          <h3 className="text-xl font-bold mb-2">{service.name}</h3>
                          <p className="text-gray-600 mb-4">{service.description}</p>
                          <div className="flex justify-between items-center mb-4">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                              {service.category}
                            </span>
                            <span className="text-2xl font-bold text-indigo-600">
                              ৳{service.price}
                            </span>
                          </div>
                          <Link
                            to={`/order?service=${service.id}`}
                            className="w-full block text-center bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition font-semibold"
                          >
                            অর্ডার করুন
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* কল টু এক্শন */}
      <div className="bg-indigo-600 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">আপনার অর্ডার এখনই শুরু করুন</h2>
          <p className="text-indigo-100 mb-6 text-lg">
            বিশেষ ছাড় এবং অফার পেতে আজই অর্ডার করুন
          </p>
          <Link
            to="/order"
            className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            এখনই শুরু করুন
          </Link>
        </div>
      </div>
    </div>
  )
}
