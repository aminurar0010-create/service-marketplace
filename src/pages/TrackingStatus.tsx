import { useState } from 'react'
import { supabase, Order, Service } from '../lib/supabase'
import { Search, CheckCircle, Clock, AlertCircle } from 'lucide-react'

export default function TrackingStatus() {
  const [trackingId, setTrackingId] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setOrder(null)
    setService(null)
    setLoading(true)
    setSearched(true)

    if (!trackingId.trim()) {
      setError('ট্র্যাকিং আইডি প্রবেশ করুন')
      setLoading(false)
      return
    }

    try {
      // Supabase-এ ফাংশন কল করার পরিবর্তে সরাসরি যোগাযোগ করি
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('tracking_id', trackingId)
        .single()

      if (fetchError || !data) {
        setError('অর্ডার খুঁজে পাওয়া যায়নি। ট্র্যাকিং আইডি চেক করুন।')
        setLoading(false)
        return
      }

      setOrder(data)

      // সার্ভিস বিবরণ পান
      if (data.service_id) {
        const { data: serviceData } = await supabase
          .from('services')
          .select('*')
          .eq('id', data.service_id)
          .single()

        if (serviceData) {
          setService(serviceData)
        }
      }
    } catch (err) {
      console.error('ত্রুটি:', err)
      setError('অর্ডার যাচাই করার সময় ত্রুটি হয়েছে।')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600'
      case 'processing':
        return 'text-blue-600'
      case 'completed':
        return 'text-green-600'
      case 'cancelled':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'অপেক্ষায়'
      case 'processing':
        return 'প্রক্রিয়াধীন'
      case 'completed':
        return 'সম্পন্ন'
      case 'cancelled':
        return 'বাতিল'
      default:
        return 'অজানা'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-green-600" />
      case 'processing':
        return <Clock className="w-8 h-8 text-blue-600" />
      case 'pending':
        return <AlertCircle className="w-8 h-8 text-yellow-600" />
      default:
        return <AlertCircle className="w-8 h-8 text-gray-600" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* সার্চ সেকশন */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold mb-6 text-center">অর্ডার ট্র্যাক করুন</h1>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                placeholder="আপনার ট্র্যাকিং আইডি এখানে লিখুন"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none text-lg font-mono"
              />
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'খুঁজছি...' : 'ট্র্যাক করুন'}
            </button>
          </form>
        </div>

        {/* ফলাফল */}
        {searched && (
          <>
            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
                <p className="text-red-600 font-semibold text-lg">{error}</p>
              </div>
            ) : order ? (
              <div className="bg-white rounded-lg shadow-lg p-8">
                {/* মূল তথ্য */}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">অর্ডার বিস্তারিত</h2>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">ট্র্যাকিং আইডি</p>
                        <p className="text-lg font-bold text-indigo-600 font-mono">
                          {order.tracking_id}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">গ্রাহক নাম</p>
                        <p className="text-lg font-bold">{order.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">ফোন নম্বর</p>
                        <p className="text-lg font-bold">{order.customer_phone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">মোট পরিমাণ</p>
                        <p className="text-lg font-bold text-green-600">৳{order.total_amount}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* সেবা তথ্য */}
                {service && (
                  <div className="mb-8">
                    <h3 className="text-xl font-bold mb-4">সেবা তথ্য</h3>
                    <div className="bg-blue-50 p-6 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">সেবা নাম</p>
                      <p className="text-lg font-bold mb-4">{service.name}</p>
                      <p className="text-sm text-gray-600 mb-2">বর্ণনা</p>
                      <p className="text-gray-700">{service.description}</p>
                    </div>
                  </div>
                )}

                {/* অবস্থা */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4">অর্ডার অবস্থা</h3>
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(order.status)}
                      <div>
                        <p className="text-sm text-gray-600">বর্তমান অবস্থা</p>
                        <p className={`text-2xl font-bold ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* পেমেন্ট অবস্থা */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4">পেমেন্ট অবস্থা</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">পেমেন্ট পদ্ধতি:</span>
                      <span>
                        {order.payment_method === 'bkash' && 'বিকাশ'}
                        {order.payment_method === 'nagad' && 'নগদ'}
                        {order.payment_method === 'rocket' && 'রকেট'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">পেমেন্ট অবস্থা:</span>
                      <span
                        className={`font-bold px-3 py-1 rounded-full text-sm ${
                          order.payment_status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : order.payment_status === 'refunded'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {order.payment_status === 'paid' && 'পরিশোধিত'}
                        {order.payment_status === 'unpaid' && 'অপরিশোধিত'}
                        {order.payment_status === 'refunded' && 'ফেরত'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* তারিখ তথ্য */}
                <div className="text-sm text-gray-500 text-center">
                  <p>অর্ডার তৈরির তারিখ: {new Date(order.created_at).toLocaleDateString('bn-BD')}</p>
                  <p>শেষ আপডেট: {new Date(order.updated_at).toLocaleDateString('bn-BD')}</p>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* নির্দেশনা */}
        {!searched && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold mb-4">কীভাবে ব্যবহার করতে হবে:</h3>
            <ol className="space-y-3 text-gray-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  ১
                </span>
                <span>আপনার অর্ডার সম্পন্ন করার সময় আপনি একটি ট্র্যাকিং আইডি পাবেন</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  ২
                </span>
                <span>উপরের ইনপুট ফিল্ডে আপনার ট্র্যাকিং আইডি লিখুন</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  ৩
                </span>
                <span>"ট্র্যাক করুন" বাটনে ক্লিক করুন</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  ৪
                </span>
                <span>আপনার অর্ডারের সম্পূর্ণ বিবরণ এবং অবস্থা দেখুন</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
