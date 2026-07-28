import { useEffect, useState } from 'react'
import { supabase, Service } from '../lib/supabase'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Upload, CheckCircle } from 'lucide-react'

export default function OrderForm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [trackingId, setTrackingId] = useState('')

  const [formData, setFormData] = useState({
    service_id: searchParams.get('service') || '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    payment_method: 'bkash',
    documents: [] as File[],
  })

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
      console.error('সার্ভিস লোড ত্রুটি:', error)
    }
  }

  const selectedService = services.find((s) => s.id === formData.service_id)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, ...files],
    }))
  }

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.service_id || !formData.customer_name || !formData.customer_phone) {
      alert('সকল প্রয়োজনীয় ক্ষেত্র পূরণ করুন')
      return
    }

    setLoading(true)

    try {
      const total_amount = selectedService?.price || 0

      // ডকুমেন্ট আপলোড করুন
      const uploadedDocs = []
      for (const file of formData.documents) {
        const fileName = `${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('order-documents')
          .upload(`${formData.customer_phone}/${fileName}`, file)

        if (!uploadError) {
          uploadedDocs.push({
            name: file.name,
            path: `${formData.customer_phone}/${fileName}`,
            size: file.size,
          })
        }
      }

      // অর্ডার তৈরি করুন
      const { data, error } = await supabase
        .from('orders')
        .insert([
          {
            service_id: formData.service_id,
            customer_name: formData.customer_name,
            customer_phone: formData.customer_phone,
            customer_email: formData.customer_email || null,
            payment_method: formData.payment_method,
            documents: uploadedDocs,
            total_amount,
            status: 'pending',
            payment_status: 'unpaid',
          },
        ])
        .select()

      if (error) throw error

      setTrackingId(data[0]?.tracking_id)
      setSubmitted(true)
      setFormData({
        service_id: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        payment_method: 'bkash',
        documents: [],
      })
    } catch (error) {
      console.error('অর্ডার সৃষ্টি ত্রুটি:', error)
      alert('অর্ডার তৈরি করতে ব্যর্থ। দয়া করে পরে চেষ্টা করুন।')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">অর্ডার সফল!</h2>
          <p className="text-gray-600 mb-6">
            আপনার অর্ডার সফলভাবে তৈরি হয়েছে।
          </p>
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-500 mb-2">আপনার ট্র্যাকিং নম্বর:</p>
            <p className="text-2xl font-bold text-indigo-600 font-mono">{trackingId}</p>
          </div>
          <p className="text-gray-600 mb-6">
            এই নম্বরটি দিয়ে আপনি যেকোনো সময় আপনার অর্ডারের অবস্থা জানতে পারবেন।
          </p>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/tracking')}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              ট্র্যাকিং চেক করুন
            </button>
            <button
              onClick={() => {
                setSubmitted(false)
                window.scrollTo(0, 0)
              }}
              className="w-full border border-indigo-600 text-indigo-600 py-2 rounded-lg hover:bg-indigo-50 transition"
            >
              নতুন অর্ডার তৈরি করুন
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">নতুন অর্ডার তৈরি করুন</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
        {/* সেবা নির্বাচন */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">সেবা নির্বাচন করুন *</label>
          <select
            value={formData.service_id}
            onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">-- একটি সেবা বেছে নিন --</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} (৳{service.price})
              </option>
            ))}
          </select>
        </div>

        {/* নাম */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">সম্পূর্ণ নাম *</label>
          <input
            type="text"
            required
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="আপনার সম্পূর্ণ নাম"
          />
        </div>

        {/* ফোন নম্বর */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">ফোন নম্বর *</label>
          <input
            type="tel"
            required
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="০১X XXXX XXXX"
          />
        </div>

        {/* ইমেইল */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">ইমেইল (ঐচ্ছিক)</label>
          <input
            type="email"
            value={formData.customer_email}
            onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="আপনার ইমেইল"
          />
        </div>

        {/* পেমেন্ট পদ্ধতি */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">পেমেন্ট পদ্ধতি *</label>
          <div className="space-y-2">
            {['bkash', 'nagad', 'rocket'].map((method) => (
              <label key={method} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="payment"
                  value={method}
                  checked={formData.payment_method === method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                />
                <span className="font-semibold">
                  {method === 'bkash' && 'বিকাশ'}
                  {method === 'nagad' && 'নগদ'}
                  {method === 'rocket' && 'রকেট'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* ডকুমেন্ট আপলোড */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">ডকুমেন্ট আপলোড করুন</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-indigo-600 font-semibold">ফাইল বাছাই করুন</span> বা ড্র্যাগ করুন
            </label>
            <p className="text-sm text-gray-500 mt-2">
              PDF, JPG, PNG, DOC ফাইল সমর্থিত (সর্বোচ্চ ৫ ফাইল)
            </p>
          </div>

          {formData.documents.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="font-semibold">আপলোড করা ফাইলসমূহ:</p>
              {formData.documents.map((file, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                  <span className="text-sm">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-700 font-semibold"
                  >
                    সরান
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* মূল্য সারসংক্ষেপ */}
        {selectedService && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center">
              <span className="font-semibold">মোট পরিমাণ:</span>
              <span className="text-2xl font-bold text-indigo-600">৳{selectedService.price}</span>
            </div>
          </div>
        )}

        {/* সাবমিট বাটন */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'অর্ডার তৈরি করছি...' : 'অর্ডার তৈরি করুন'}
        </button>
      </form>
    </div>
  )
}
