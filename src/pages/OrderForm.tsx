import { useEffect, useState } from 'react'
import { supabase, Service, CouponValidationResult, CreateOrderResult } from '../lib/supabase'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Upload, CheckCircle, Tag, X } from 'lucide-react'

export default function OrderForm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [trackingId, setTrackingId] = useState('')
  const [finalAmountPaid, setFinalAmountPaid] = useState(0)

  const [formData, setFormData] = useState({
    service_id: searchParams.get('service') || '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    payment_method: 'bkash',
    documents: [] as File[],
  })

  // কুপন সংক্রান্ত স্টেট
  const [couponInput, setCouponInput] = useState('')
  const [couponChecking, setCouponChecking] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discount_amount: number
    final_amount: number
  } | null>(null)
  const [couponMessage, setCouponMessage] = useState<{ text: string; ok: boolean } | null>(null)

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
  const totalAmount = selectedService?.price || 0

  // সার্ভিস বা ফোন নম্বর বদলালে আগের প্রয়োগ করা কুপন বাতিল হয়ে যাবে
  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null)
      setCouponMessage(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.service_id, formData.customer_phone])

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

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return

    if (!formData.service_id) {
      setCouponMessage({ text: 'প্রথমে একটি সেবা নির্বাচন করুন', ok: false })
      return
    }
    if (!formData.customer_phone) {
      setCouponMessage({ text: 'কুপন যাচাই করতে ফোন নম্বর দিন', ok: false })
      return
    }

    setCouponChecking(true)
    setCouponMessage(null)

    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: couponInput.trim(),
        p_service_id: formData.service_id,
        p_order_amount: totalAmount,
        p_customer_phone: formData.customer_phone,
      })

      if (error) throw error

      const result = data as CouponValidationResult

      if (result.valid) {
        setAppliedCoupon({
          code: couponInput.trim().toUpperCase(),
          discount_amount: result.discount_amount || 0,
          final_amount: result.final_amount ?? totalAmount,
        })
        setCouponMessage({ text: result.message, ok: true })
      } else {
        setAppliedCoupon(null)
        setCouponMessage({ text: result.message, ok: false })
      }
    } catch (error) {
      console.error('কুপন যাচাই ত্রুটি:', error)
      setCouponMessage({ text: 'কুপন যাচাই করতে ব্যর্থ। আবার চেষ্টা করুন।', ok: false })
    } finally {
      setCouponChecking(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.service_id || !formData.customer_name || !formData.customer_phone) {
      alert('সকল প্রয়োজনীয় ক্ষেত্র পূরণ করুন')
      return
    }

    setLoading(true)

    try {
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

      // অর্ডার তৈরি করুন (RLS bypass করা SECURITY DEFINER ফাংশন দিয়ে)
      const { data, error } = await supabase.rpc('create_order', {
        p_service_id: formData.service_id,
        p_customer_name: formData.customer_name,
        p_customer_phone: formData.customer_phone,
        p_customer_email: formData.customer_email || null,
        p_payment_method: formData.payment_method,
        p_documents: uploadedDocs,
        p_total_amount: totalAmount,
        p_coupon_code: appliedCoupon?.code || null,
      })

      if (error) throw error

      const result = data as CreateOrderResult

      if (!result.success) {
        alert(result.message || 'কুপন প্রয়োগ করা যায়নি। দয়া করে কুপন ছাড়া আবার চেষ্টা করুন।')
        setLoading(false)
        return
      }

      setTrackingId(result.tracking_id || '')
      setFinalAmountPaid(result.final_amount ?? totalAmount)
      setSubmitted(true)
      setFormData({
        service_id: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        payment_method: 'bkash',
        documents: [],
      })
      setAppliedCoupon(null)
      setCouponInput('')
      setCouponMessage(null)
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
          <p className="text-gray-600 mb-2">
            পরিশোধযোগ্য মোট পরিমাণ:
          </p>
          <p className="text-xl font-bold text-gray-800 mb-6">৳{finalAmountPaid}</p>
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

        {/* কুপন কোড */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">কুপন কোড (ঐচ্ছিক)</label>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-300 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-700">{appliedCoupon.code}</span>
                <span className="text-sm text-green-700">
                  (-৳{appliedCoupon.discount_amount} ছাড়)
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-gray-500 hover:text-red-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase"
                placeholder="কুপন কোড লিখুন"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={couponChecking || !couponInput.trim()}
                className="bg-gray-800 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {couponChecking ? 'যাচাই হচ্ছে...' : 'প্রয়োগ করুন'}
              </button>
            </div>
          )}
          {couponMessage && (
            <p className={`text-sm mt-2 ${couponMessage.ok ? 'text-green-600' : 'text-red-600'}`}>
              {couponMessage.text}
            </p>
          )}
        </div>

        {/* মূল্য সারসংক্ষেপ */}
        {selectedService && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">সাবটোটাল:</span>
              <span className="font-semibold">৳{totalAmount}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between items-center text-green-600">
                <span>ছাড় ({appliedCoupon.code}):</span>
                <span className="font-semibold">-৳{appliedCoupon.discount_amount}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-gray-200 pt-2">
              <span className="font-semibold">মোট পরিমাণ:</span>
              <span className="text-2xl font-bold text-indigo-600">
                ৳{appliedCoupon ? appliedCoupon.final_amount : totalAmount}
              </span>
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
