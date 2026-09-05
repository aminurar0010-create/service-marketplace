import { useState } from 'react'
import { X, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'

// দোকানে কাস্টমার সরাসরি এলে দ্রুত অর্ডার তৈরি করার জন্য — যত কম ঘর পূরণ করতে হয় তত ভালো
export default function QuickOrderModal({ ctx, onClose }: { ctx: any; onClose: () => void }) {
  const { services, staffList, logActivity, fetchData } = ctx

  const [serviceId, setServiceId] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [customServiceName, setCustomServiceName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentReceived, setPaymentReceived] = useState(false)
  const [assignedStaffId, setAssignedStaffId] = useState('')
  const [priority, setPriority] = useState('normal')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successTrackingId, setSuccessTrackingId] = useState('')

  const selectedService = services.find((s: any) => s.id === serviceId)

  const handleServiceChange = (id: string) => {
    setServiceId(id)
    const svc = services.find((s: any) => s.id === id)
    if (svc) setPrice(svc.price)
  }

  const handleSubmit = async () => {
    setError('')
    if (isCustom) {
      if (!customServiceName.trim() || !customerName.trim() || !customerPhone.trim() || price === '') {
        setError('কাস্টম সার্ভিসের নাম, কাস্টমারের নাম, মোবাইল ও মূল্য দিন')
        return
      }
    } else if (!serviceId || !customerName.trim() || !customerPhone.trim() || price === '') {
      setError('সার্ভিস, নাম, মোবাইল ও মূল্য দিন')
      return
    }

    setLoading(true)
    try {
      let finalServiceId = serviceId

      // কাস্টম/এককালীন সার্ভিস হলে প্রথমে একটা নিষ্ক্রিয় (is_active=false) সার্ভিস রো বানিয়ে নিন —
      // এতে পাবলিক তালিকায় দেখাবে না, কিন্তু create_order ফাংশন স্বাভাবিকভাবেই কাজ করবে
      if (isCustom) {
        const { data: newService, error: serviceError } = await supabase
          .from('services')
          .insert({
            name: customServiceName.trim(),
            price: Number(price),
            category: 'কাস্টম/এককালীন',
            is_active: false,
            estimated_hours: 24,
          })
          .select('id')
          .single()
        if (serviceError) throw serviceError
        finalServiceId = newService.id
      }

      const { data, error: rpcError } = await supabase.rpc('create_order', {
        p_service_id: finalServiceId,
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone.trim(),
        p_customer_email: null,
        p_payment_method: paymentMethod,
        p_documents: [],
        p_total_amount: Number(price),
        p_coupon_code: null,
        p_is_urgent: priority === 'urgent',
        p_custom_field_responses: [],
      })

      if (rpcError) throw rpcError
      const result = data as any
      if (!result?.success) {
        setError(result?.message || 'অর্ডার তৈরি করা যায়নি')
        setLoading(false)
        return
      }

      const trackingId = result.tracking_id as string

      // কুইক অর্ডারের বাড়তি তথ্য (প্রায়োরিটি, স্টাফ, নোট, পেমেন্ট) আলাদাভাবে সেভ করুন
      const updatePayload: Record<string, any> = { priority }
      if (assignedStaffId) updatePayload.assigned_staff_id = assignedStaffId
      if (note.trim()) updatePayload.internal_note = note.trim()
      if (paymentReceived) updatePayload.payment_status = 'paid'

      await supabase.from('orders').update(updatePayload).eq('tracking_id', trackingId)

      logActivity?.('কুইক অর্ডার তৈরি করেছেন', 'order', trackingId, {
        customer: customerName.trim(),
        service: isCustom ? customServiceName.trim() : selectedService?.name,
      })

      setSuccessTrackingId(trackingId)
      fetchData?.()
    } catch (err) {
      console.error('কুইক অর্ডার ত্রুটি:', err)
      setError('অর্ডার তৈরি করতে ব্যর্থ। দয়া করে আবার চেষ্টা করুন।')
    } finally {
      setLoading(false)
    }
  }

  if (successTrackingId) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Zap className="text-green-600" size={26} />
          </div>
          <h2 className="text-lg font-bold mb-1">অর্ডার তৈরি হয়েছে!</h2>
          <p className="text-sm text-gray-500 mb-4">ট্র্যাকিং আইডি</p>
          <p className="text-xl font-mono font-bold text-indigo-600 mb-6">{successTrackingId}</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSuccessTrackingId('')
                setServiceId('')
                setIsCustom(false)
                setCustomServiceName('')
                setCustomerName('')
                setCustomerPhone('')
                setPrice('')
                setAssignedStaffId('')
                setPriority('normal')
                setNote('')
                setPaymentReceived(false)
              }}
              className="flex-1 border border-gray-300 rounded-lg py-2 font-semibold hover:bg-gray-50"
            >
              আরেকটা তৈরি করুন
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 font-semibold hover:bg-indigo-700"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap size={18} className="text-amber-500" /> দ্রুত অর্ডার
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

          <div>
            <label className="block text-sm font-semibold mb-1">সার্ভিস *</label>
            {isCustom ? (
              <input
                type="text"
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                placeholder="যেমনঃ বিশেষ ডিজাইন অর্ডার"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <select
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">সিলেক্ট করুন</option>
                {services.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ৳{s.price}
                  </option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCustom}
                onChange={(e) => {
                  setIsCustom(e.target.checked)
                  setServiceId('')
                }}
                className="w-4 h-4"
              />
              <span className="text-xs text-gray-600">কাস্টম সার্ভিস (তালিকায় নেই)</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">কাস্টমারের নাম *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">মোবাইল *</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">মূল্য (৳) *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">পেমেন্ট মেথড</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="cash">ক্যাশ</option>
                <option value="qr">সুপার কিউআর</option>
                <option value="bkash">বিকাশ</option>
                <option value="nagad">নগদ</option>
                <option value="rocket">রকেট</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={paymentReceived}
              onChange={(e) => setPaymentReceived(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold">পেমেন্ট এখনই গ্রহণ করা হয়েছে</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">স্টাফ (ঐচ্ছিক)</label>
              <select
                value={assignedStaffId}
                onChange={(e) => setAssignedStaffId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">অনির্ধারিত</option>
                {staffList.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">প্রায়োরিটি</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="low">কম</option>
                <option value="normal">সাধারণ</option>
                <option value="important">গুরুত্বপূর্ণ</option>
                <option value="urgent">জরুরি</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">নোট (ঐচ্ছিক)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2.5 font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'তৈরি হচ্ছে...' : 'অর্ডার তৈরি করুন'}
          </button>
        </div>
      </div>
    </div>
  )
}
